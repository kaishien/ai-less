require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT ?? 3000;
const { AI_URL, OPENROUTER_API_KEY_FREE } = process.env;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/ai', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const response = await axios.post(AI_URL,
            {
                model: 'openrouter/free',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: message }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY_FREE}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return res.json({
            success: true,
            data: response.data.choices[0].message.content
        });
    } catch (error) {
        console.error('Error details:', error.response?.data || error.message);
        return res.status(500).json({
            error: 'Something went wrong',
            details: error.response?.data || error.message
        });
    }
});

app.listen(PORT, (err) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Server is running on port ${PORT}`);
});