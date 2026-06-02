require('dotenv').config();
const express = require('express');
const axios = require('axios');
const oAuth = require('./auth');

const app = express();
const PORT = process.env.PORT ?? 3000;
const { AI_URL } = process.env;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/ai', async (req, res) => {
    try {
        const { access_token } = await oAuth();
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const response = await axios.post(AI_URL,
            {
                model: 'GigaChat', messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: text }],
            },
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        return res.json(response.data.choices[0].message.content);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Something went wrong' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});