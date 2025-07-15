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

// Parse stock list function with improved selectors
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

// Parse modern stock structure
function parseModernStock($, stockType) {
    const items = [];
    
    // Try multiple selectors for different stock types
    const selectors = [
        `h2:contains("${stockType}") ~ div img[alt]`,
        `h2:contains("${stockType}") + div img[alt]`,
        `h3:contains("${stockType}") ~ div img[alt]`,
        `h3:contains("${stockType}") + div img[alt]`,
        `div:contains("${stockType}") img[alt]`,
        `img[alt*="${stockType}"]`
    ];
    
    selectors.forEach(selector => {
        $(selector).each((i, el) => {
            const alt = $(el).attr('alt');
            if (alt && alt.trim()) {
                items.push(alt.trim());
            }
        });
    });
    
    // Remove duplicates
    return [...new Set(items)];
}

// Fetch stock data
async function fetchStockData() {
    try {
        const response = await fetch('https://growagarden.gg/stocks');
        const html = await response.text();
        const $ = cheerio.load(html);

        // Modern approach: try to find images with alt text
        const seeds = [];
        const gears = [];
        const eggs = [];

        // Method 1: Look for images with alt text (modern approach)
        $('img[alt]').each((i, el) => {
            const alt = $(el).attr('alt');
            if (alt && alt.trim()) {
                const item = alt.trim();
                
                // Check parent elements for context
                const parent = $(el).parent();
                const parentText = parent.text().toLowerCase();
                const grandParent = parent.parent();
                const grandParentText = grandParent.text().toLowerCase();
                
                // Classify items based on context or item names
                if (parentText.includes('seed') || grandParentText.includes('seed') || 
                    item.toLowerCase().includes('seed') || item.toLowerCase().includes('berry') ||
                    item.toLowerCase().includes('fruit') || item.toLowerCase().includes('plant')) {
                    seeds.push(item);
                } else if (parentText.includes('gear') || grandParentText.includes('gear') ||
                          item.toLowerCase().includes('tool') || item.toLowerCase().includes('sprinkler') ||
                          item.toLowerCase().includes('trowel') || item.toLowerCase().includes('watering') ||
                          item.toLowerCase().includes('wrench') || item.toLowerCase().includes('favorite')) {
                    gears.push(item);
                } else if (parentText.includes('egg') || grandParentText.includes('egg') ||
                          item.toLowerCase().includes('egg') || item.toLowerCase().includes('pet')) {
                    eggs.push(item);
                }
            }
        });

        // Method 2: Traditional selector approach (fallback)
        if (seeds.length === 0 && gears.length === 0 && eggs.length === 0) {
            // Try different selectors for each category
            const seedSelectors = [
                'h2:contains("Seed") ~ div img[alt]',
                'h3:contains("Seed") + ul > li',
                'div:contains("Seed Shop") img[alt]',
                '.seed-shop img[alt]',
                '[data-testid="seed-shop"] img[alt]'
            ];
            
            const gearSelectors = [
                'h2:contains("Gear") ~ div img[alt]',
                'h3:contains("Gear") + ul > li',
                'div:contains("Gear Shop") img[alt]',
                '.gear-shop img[alt]',
                '[data-testid="gear-shop"] img[alt]'
            ];
            
            const eggSelectors = [
                'h2:contains("Egg") ~ div img[alt]',
                'h3:contains("Egg") + ul > li',
                'div:contains("Egg Shop") img[alt]',
                '.egg-shop img[alt]',
                '[data-testid="egg-shop"] img[alt]'
            ];

            // Try seed selectors
            seedSelectors.forEach(selector => {
                $(selector).each((i, el) => {
                    const alt = $(el).attr('alt');
                    const text = $(el).text().trim();
                    if (alt && alt.trim()) {
                        seeds.push(alt.trim());
                    } else if (text) {
                        seeds.push(text);
                    }
                });
            });

            // Try gear selectors
            gearSelectors.forEach(selector => {
                $(selector).each((i, el) => {
                    const alt = $(el).attr('alt');
                    const text = $(el).text().trim();
                    if (alt && alt.trim()) {
                        gears.push(alt.trim());
                    } else if (text) {
                        gears.push(text);
                    }
                });
            });

            // Try egg selectors
            eggSelectors.forEach(selector => {
                $(selector).each((i, el) => {
                    const alt = $(el).attr('alt');
                    const text = $(el).text().trim();
                    if (alt && alt.trim()) {
                        eggs.push(alt.trim());
                    } else if (text) {
                        eggs.push(text);
                    }
                });
            });
        }

        // Method 3: Parse all text content and try to identify items
        if (seeds.length === 0 && gears.length === 0 && eggs.length === 0) {
            const bodyText = $('body').text();
            console.log('Fallback: Page content preview:', bodyText.substring(0, 500));
            
            // Look for structured content
            $('div, section, article').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 5 && text.length < 100) {
                    // Check if it looks like an item name
                    if (text.match(/^[A-Za-z\s]+$/)) {
                        const lowerText = text.toLowerCase();
                        if (lowerText.includes('seed') || lowerText.includes('berry') || lowerText.includes('fruit')) {
                            seeds.push(text);
                        } else if (lowerText.includes('tool') || lowerText.includes('gear') || lowerText.includes('sprinkler')) {
                            gears.push(text);
                        } else if (lowerText.includes('egg') || lowerText.includes('pet')) {
                            eggs.push(text);
                        }
                    }
                }
            });
        }

        // Remove duplicates and clean up
        const uniqueSeeds = [...new Set(seeds)].filter(item => item && item.length > 0);
        const uniqueGears = [...new Set(gears)].filter(item => item && item.length > 0);
        const uniqueEggs = [...new Set(eggs)].filter(item => item && item.length > 0);

        console.log('Parsed stocks:', {
            seeds: uniqueSeeds.length,
            gears: uniqueGears.length,
            eggs: uniqueEggs.length
        });

        return {
            seeds: uniqueSeeds,
            gears: uniqueGears,
            eggs: uniqueEggs
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

        // Multiple approaches to extract weather data
        let currentWeather = '';
        let temperature = '';
        let humidity = '';
        let wind = '';
        let forecast = '';

        // Method 1: Try standard selectors
        currentWeather = $('h2:contains("Current Weather") + p').text().trim() || 
                        $('p:contains("Current Weather")').text().trim() ||
                        $('h2:contains("Current Weather")').next('p').text().trim();
        
        temperature = $('p:contains("Temperature")').text().trim();
        humidity = $('p:contains("Humidity")').text().trim();
        wind = $('p:contains("Wind")').text().trim();
        forecast = $('h3:contains("Weather Forecast") + p').text().trim() ||
                  $('h3:contains("Forecast") + p').text().trim() ||
                  $('h3:contains("Weather Forecast")').next('p').text().trim();

        // Method 2: Look for weather-related content more broadly
        if (!currentWeather) {
            $('div, section, p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.includes('Current Weather') || text.includes('Weather:')) {
                    currentWeather = text;
                }
                if (text.includes('Temperature') || text.includes('°')) {
                    temperature = text;
                }
                if (text.includes('Humidity') || text.includes('%')) {
                    humidity = text;
                }
                if (text.includes('Wind') || text.includes('mph') || text.includes('km/h')) {
                    wind = text;
                }
                if (text.includes('Forecast') || text.includes('Next')) {
                    forecast = text;
                }
            });
        }

        // Method 3: If still no data, try to parse from JSON or data attributes
        if (!currentWeather) {
            try {
                const scripts = $('script');
                scripts.each((i, el) => {
                    const scriptContent = $(el).html();
                    if (scriptContent && scriptContent.includes('weather')) {
                        console.log('Found weather script:', scriptContent.substring(0, 200));
                        // Try to extract weather data from JSON
                        const weatherMatch = scriptContent.match(/"weather":\s*"([^"]+)"/);
                        if (weatherMatch) {
                            currentWeather = weatherMatch[1];
                        }
                    }
                });
            } catch (e) {
                console.log('Error parsing weather scripts:', e.message);
            }
        }

        console.log('Weather data extracted:', {
            current: currentWeather ? 'Found' : 'Not found',
            temperature: temperature ? 'Found' : 'Not found',
            humidity: humidity ? 'Found' : 'Not found',
            wind: wind ? 'Found' : 'Not found',
            forecast: forecast ? 'Found' : 'Not found'
        });

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

        console.log('Fetching data from growagarden.gg...');

        // Fetch both stock and weather data concurrently
        const [stockData, weatherData] = await Promise.all([
            fetchStockData(),
            fetchWeatherData()
        ]);

        console.log('Data fetched successfully:', {
            stockItems: stockData.seeds.length + stockData.gears.length + stockData.eggs.length,
            weatherDataAvailable: weatherData.current !== 'Tidak tersedia'
        });

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

// Debug endpoint to check raw HTML
app.get('/api/debug', async (req, res) => {
    try {
        const stockResponse = await fetch('https://growagarden.gg/stocks');
        const stockHtml = await stockResponse.text();
        
        const weatherResponse = await fetch('https://growagarden.gg/weather');
        const weatherHtml = await weatherResponse.text();

        res.json({
            stockPreview: stockHtml.substring(0, 1000),
            weatherPreview: weatherHtml.substring(0, 1000),
            stockLength: stockHtml.length,
            weatherLength: weatherHtml.length
        });
    } catch (error) {
        res.status(500).json({
            error: 'Debug failed',
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
