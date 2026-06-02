import { FileService } from '../services/File.service.js';
import { formatGigaChatError } from '../utils/gigachat.js';

export class FileController {
    static async upload(req, res) {
        const { uploadedFiles } = res.locals;
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не был загружен' });
        }

        try {
            FileService.registerUploadedFile(uploadedFiles, req.file);

            const isText = FileService.isTextUpload(req.file);
            if (isText) {
                await FileService.indexUploadedTextFile(req.file);
            }

            return res.json({
                message: isText
                    ? 'Файл загружен, проиндексирован и готов для RAG'
                    : 'Файл загружен, но не проиндексирован (поддерживаются только текстовые файлы)',
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                indexed: !!isText
            });
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка при обработке файла: ' + formatGigaChatError(error) });
        }
    }

    static list(req, res) {
        const { uploadedFiles } = res.locals;
        const files = FileService.list(uploadedFiles);
        return res.json({ files });
    }

    static async delete(req, res) {
        const { uploadedFiles } = res.locals;
        const { filename } = req.params;

        try {
            const result = await FileService.delete(uploadedFiles, filename);
            if (result.error === 'not_found') {
                return res.status(404).json({ error: 'Файл не найден' });
            }
            if (result.error === 'unlink_failed') {
                return res.status(500).json({ error: 'Ошибка при удалении файла: ' + (result.details || '') });
            }

            return res.json({ message: 'Файл успешно удален' });
        } catch (error) {
            return res.status(500).json({ error: 'Ошибка при удалении файла: ' + error.message });
        }
    }
}
