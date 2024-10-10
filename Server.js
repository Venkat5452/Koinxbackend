const express=require('express')
const cors=require('cors');
const mongoose=require('mongoose');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const server=express()
server.use(express.json()) 
server.use(express.urlencoded({ extended: true }))
server.use(cors())
mongoose
  .connect(process.env.MYURL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log(err);
  });

  //schema

  const cryptoSchema = new mongoose.Schema({
    coinId: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    marketCap: {
        type: Number,  
        required: true,
    },
    change24h: {
        type: Number,  
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

//Model
const Crypto = mongoose.model('Crypto', cryptoSchema);

async function fetchCryptoData(coinId) {
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`);
        const data = response.data.market_data;
        const price = data.current_price.usd;
        const marketCap = data.market_cap.usd;
        const change24h = data.price_change_percentage_24h;
        const crypto = new Crypto({
            coinId,
            price,
            marketCap, // Save market cap
            change24h// Save 24h change
        });
        await crypto.save();
        console.log(`${coinId.toUpperCase()} data saved: Price: $${price}, Market Cap: $${marketCap}, 24h Change: ${change24h}%`);
    } catch (error) {
        console.error(`Error fetching data for ${coinId}:`, error);
    }
}

cron.schedule('0 */2 * * *', () => {
    ['bitcoin', 'matic-network', 'ethereum'].forEach(fetchCryptoData);
    console.log('Data fetched and saved to the database');
});

server.get('/stats', async (req, res) => {
    const { coin } = req.query;
    const latestData = await Crypto.findOne({ coinId: coin }).sort({ timestamp: -1 });
    if (latestData) {
        return res.json({
            price: latestData.price,
            marketCap: latestData.marketCap,
            "24hChange": latestData.change24h,
        });
    } else {
        return res.status(404).json({ error: 'No data found' });
    }
});

server.get('/deviation', async (req, res) => {
    const { coin } = req.query;
    const prices = await Crypto.find({ coinId: coin }).sort({ timestamp: -1 }).limit(100).select('price');
    if (prices.length > 0) {
        const priceValues = prices.map(p => p.price);
        const mean = priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length;
        const variance = priceValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / priceValues.length;
        const deviation = Math.sqrt(variance);

        return res.json({ deviation });
    } else {
        return res.status(404).json({ error: 'Not enough data to calculate deviation' });
    }
});

server.listen((9110),()=>{
    console.log("Server Running in 9110 port");
})