// Клиентская логика интерфейса:
// - Загрузка файлов
// - Общение в чате с GigaChat
// - Список и удаление файлов
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadForm = document.getElementById('uploadForm');
    const resultSection = document.getElementById('resultSection');
    const resultContent = document.getElementById('resultContent');

    // Элементы чата
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const filesList = document.getElementById('filesList');

    // Обработка выбора файла: показываем имя/размер и активируем кнопку
    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];

        if (file) {
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
        } else {
            fileInfo.style.display = 'none';
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.6';
        }
    });

    // Отправка формы загрузки: POST /upload, индикация состояния, обновление списка
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const formData = new FormData();
        const file = fileInput.files[0];

        if (!file) {
            showResult('error', 'Пожалуйста, выберите файл для загрузки');
            return;
        }

        formData.append('file', file);

        // Показываем индикатор загрузки
        uploadBtn.textContent = 'Загрузка...';
        uploadBtn.disabled = true;
        showResult('loading', 'Файл загружается...');

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showResult('error', data.error);
                } else {
                    showResult('success', `Файл "${data.originalName}" успешно загружен!`);
                    // Очищаем форму
                    uploadForm.reset();
                    fileInfo.style.display = 'none';
                    uploadBtn.disabled = true;
                    uploadBtn.style.opacity = '0.6';
                }
            })
            .catch(error => {
                showResult('error', 'Ошибка при загрузке файла: ' + error.message);
            })
            .finally(() => {
                uploadBtn.textContent = 'Загрузить файл';
                uploadBtn.disabled = false;
            });

        // Обновляем список файлов после загрузки
        loadFiles();
    });

    // Отправка сообщения в чат: добавляем локально и отправляем на сервер
    chatForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const message = messageInput.value.trim();
        if (!message) return;

        // Добавляем сообщение пользователя
        addMessage(message, 'user');
        messageInput.value = '';

        // Отправляем запрос к GigaChat
        sendMessage(message);
    });

    // Функция отправки сообщения к GigaChat
    async function sendMessage(message) {
        try {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span>⏳</span>';

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (data.error) {
                addMessage('Ошибка: ' + data.error, 'system');
            } else {
                addMessage(data.response, 'assistant');
            }
        } catch (error) {
            addMessage('Ошибка при отправке сообщения: ' + error.message, 'system');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<span>📤</span>';
        }
    }

    // Добавление сообщения в чат
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        // Прокручиваем к последнему сообщению
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Загрузка списка файлов
    async function loadFiles() {
        try {
            const response = await fetch('/files');
            const data = await response.json();

            if (data.files.length === 0) {
                filesList.innerHTML = '<p class="no-files">Нет загруженных файлов</p>';
            } else {
                filesList.innerHTML = data.files.map(file => `
                    <div class="file-item">
                        <div class="file-info">
                            <div class="file-name">${file.originalName}</div>
                            <div class="file-details">
                                Размер: ${formatFileSize(file.size)} | 
                                Загружен: ${new Date(file.uploadedAt).toLocaleString()}
                            </div>
                        </div>
                        <button class="delete-btn" onclick="deleteFile('${file.filename}')">Удалить</button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Ошибка при загрузке файлов:', error);
        }
    }

    // Удаление файла по имени (подтверждение + DELETE /files/:filename)
    window.deleteFile = async function (filename) {
        if (!confirm('Вы уверены, что хотите удалить этот файл?')) return;

        try {
            const response = await fetch(`/files/${filename}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.error) {
                alert('Ошибка при удалении файла: ' + data.error);
            } else {
                loadFiles();
                addMessage('Файл успешно удален', 'system');
            }
        } catch (error) {
            alert('Ошибка при удалении файла: ' + error.message);
        }
    };

    // Форматирование размера файла
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Отображение результатов операций (успех/ошибка/загрузка)
    function showResult(type, message) {
        resultSection.style.display = 'block';

        let className = '';
        switch (type) {
            case 'success':
                className = 'success';
                break;
            case 'error':
                className = 'error';
                break;
            case 'loading':
                className = 'loading';
                break;
        }

        resultContent.innerHTML = `<div class="${className}">${message}</div>`;

        // Автоматически скрываем результат через 5 секунд
        if (type !== 'loading') {
            setTimeout(() => {
                resultSection.style.display = 'none';
            }, 5000);
        }
    }

    // Загружаем список файлов при загрузке страницы
    loadFiles();
});
