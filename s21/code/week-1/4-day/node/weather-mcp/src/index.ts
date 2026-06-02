/**
 * Сервер MCP (Model Context Protocol) для получения данных о погоде.
 * Использует API Национальной метеорологической службы США (NWS).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Базовый URL API Национальной метеорологической службы США
const NWS_API_BASE = "https://api.weather.gov";
// User-Agent для запросов к API
const USER_AGENT = "weather-app/1.0";

// Создание экземпляра MCP сервера с базовой конфигурацией
const server = new McpServer({
    name: "weather",
    version: "1.0.0",
});

/**
 * Вспомогательная функция для выполнения запросов к API NWS
 * @param url - URL для запроса
 * @returns Promise с данными ответа или null в случае ошибки
 */
async function makeNWSRequest<T>(url: string): Promise<T | null> {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
}

// Интерфейсы для типизации данных погодных предупреждений
interface AlertFeature {
    properties: {
        event?: string;
        areaDesc?: string;
        severity?: string;
        status?: string;
        headline?: string;
    };
}

/**
 * Форматирует данные погодного предупреждения в читаемый текст
 * @param feature - Объект с данными предупреждения
 * @returns Отформатированная строка с информацией
 */
function formatAlert(feature: AlertFeature): string {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}

// Интерфейсы для типизации данных прогноза погоды
interface ForecastPeriod {
    name?: string;
    temperature?: number;
    temperatureUnit?: string;
    windSpeed?: string;
    windDirection?: string;
    shortForecast?: string;
}

interface AlertsResponse {
    features: AlertFeature[];
}

interface PointsResponse {
    properties: {
        forecast?: string;
    };
}

interface ForecastResponse {
    properties: {
        periods: ForecastPeriod[];
    };
}

// Регистрация инструмента для получения погодных предупреждений
server.registerTool(
    "get-alerts",
    {
        description: "Get weather alerts for a state",
        inputSchema: {
            state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
        },
    },
    async ({ state }) => {
        const stateCode = state.toUpperCase();
        const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
        const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

        if (!alertsData) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve alerts data",
                    },
                ],
            };
        }

        const features = alertsData.features || [];
        if (features.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No active alerts for ${stateCode}`,
                    },
                ],
            };
        }

        const formattedAlerts = features.map(formatAlert);
        const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

        return {
            content: [
                {
                    type: "text",
                    text: alertsText,
                },
            ],
        };
    },
);

// Регистрация инструмента для получения прогноза погоды
server.registerTool(
    "get-forecast",
    {
        description: "Get weather forecast for a location",
        inputSchema: {
            latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
            longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
        },
    },
    async ({ latitude, longitude }) => {
        // Получение данных о координатной сетке для указанной локации
        const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

        if (!pointsData) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
                    },
                ],
            };
        }

        const forecastUrl = pointsData.properties?.forecast;
        if (!forecastUrl) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to get forecast URL from grid point data",
                    },
                ],
            };
        }

        // Получение данных прогноза погоды
        const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
        if (!forecastData) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve forecast data",
                    },
                ],
            };
        }

        const periods = forecastData.properties?.periods || [];
        if (periods.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No forecast periods available",
                    },
                ],
            };
        }

        // Форматирование периодов прогноза
        const formattedForecast = periods.map((period: ForecastPeriod) =>
            [
                `${period.name || "Unknown"}:`,
                `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
                `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
                `${period.shortForecast || "No forecast available"}`,
                "---",
            ].join("\n"),
        );

        const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

        return {
            content: [
                {
                    type: "text",
                    text: forecastText,
                },
            ],
        };
    },
);

/**
 * Основная функция для запуска сервера
 * Инициализирует транспорт stdio и подключает сервер
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}

// Запуск приложения с обработкой ошибок
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});