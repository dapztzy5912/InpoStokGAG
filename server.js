const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const moment = require('moment-timezone');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Parse stock list function
function parseStockList($, selector) {
    const items = [];
    $(selector).each((i, el) => {
        const text = $(el).text().trim();
        const match = text.match(/(.*?) - Available Stock: (\d+)/i);
        if (match) {
            items.push(`[${match[2]}x] ${match[1]}`);
        } else if (text) {
            items.push(text);
        }
    });
    return items;
}

// Fetch stock data
async function fetchStockData() {
    try {
        const response = await fetch('https://growagarden.gg/stocks');
        const html = await response.text();
        const $ = cheerio.load(html);

        // Parse different stock sections
        const seeds = parseStockList($, 'h3:contains("Current Seed Shop Stock in Grow a Garden") + ul > li');
        const gears = parseStockList($, 'h3:contains("Current Gear Shop Stock in Grow a Garden") + ul > li');
        const eggs = parseStockList($, 'h3:contains("Current Egg Shop Stock in Grow a Garden") + ul > li');

        return {
            seeds: seeds.length > 0 ? seeds : [],
            gears: gears.length > 0 ? gears : [],
            eggs: eggs.length > 0 ? eggs : []
        };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        throw error;
    }
}

// Fetch weather data
async function fetchWeatherData() {
    try {
        const response = await fetch('https://growagarden.gg/weather');
        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract weather information with more robust selectors
        const currentWeather = $('h2:contains("Current Weather") + p').text().trim() || 
                             $('p:contains("Current Weather")').text().trim() ||
                             $('h2:contains("Current Weather")').next('p').text().trim();
        
        const temperature = $('p:contains("Temperature")').text().trim();
        const humidity = $('p:contains("Humidity")').text().trim();
        const wind = $('p:contains("Wind")').text().trim();
        
        const forecast = $('h3:contains("Weather Forecast") + p').text().trim() ||
                        $('h3:contains("Forecast") + p').text().trim() ||
                        $('h3:contains("Weather Forecast")').next('p').text().trim();

        return {
            current: currentWeather || 'Tidak tersedia',
            temperature: temperature || 'Tidak tersedia',
            humidity: humidity || 'Tidak tersedia',
            wind: wind || 'Tidak tersedia',
            forecast: forecast || 'Tidak tersedia'
        };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

// API endpoint to get all data
app.get('/api/data', async (req, res) => {
    try {
        const now = moment().tz('Asia/Jakarta');
        const displayTime = now.format('D MMMM YYYY, HH:mm [WIB]');

        // Fetch both stock and weather data concurrently
        const [stockData, weatherData] = await Promise.all([
            fetchStockData(),
            fetchWeatherData()
        ]);

        res.json({
            stocks: stockData,
            weather: weatherData,
            lastUpdated: displayTime,
            timestamp: now.valueOf()
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Gagal mengambil data. Silakan coba lagi nanti.',
            details: error.message
        });
    }
});

// API endpoint for stock data only
app.get('/api/stocks', async (req, res) => {
    try {
        const stockData = await fetchStockData();
        const now = moment().tz('Asia/Jakarta');
        const displayTime = now.format('D MMMM YYYY, HH:mm [WIB]');

        res.json({
            stocks: stockData,
            lastUpdated: displayTime,
            timestamp: now.valueOf()
        });
    } catch (error) {
        console.error('Stock API Error:', error);
        res.status(500).json({
            error: 'Gagal mengambil data stok.',
            details: error.message
        });
    }
});

// API endpoint for weather data only
app.get('/api/weather', async (req, res) => {
    try {
        const weatherData = await fetchWeatherData();
        const now = moment().tz('Asia/Jakarta');
        const displayTime = now.format('D MMMM YYYY, HH:mm [WIB]');

        res.json({
            weather: weatherData,
            lastUpdated: displayTime,
            timestamp: now.valueOf()
        });
    } catch (error) {
        console.error('Weather API Error:', error);
        res.status(500).json({
            error: 'Gagal mengambil data cuaca.',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: moment().tz('Asia/Jakarta').format('D MMMM YYYY, HH:mm [WIB]'),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Terjadi kesalahan server.',
        details: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint tidak ditemukan.'
    });
});

// Start server
app.listen(port, () => {
    console.log(`🌱 Grow a Garden Info Server running on port ${port}`);
    console.log(`🌐 Open http://localhost:${port} in your browser`);
    console.log(`📡 API endpoints available at:`);
    console.log(`   - GET /api/data (all data)`);
    console.log(`   - GET /api/stocks (stock data only)`);
    console.log(`   - GET /api/weather (weather data only)`);
    console.log(`   - GET /api/health (health check)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});

module.exports = app;
