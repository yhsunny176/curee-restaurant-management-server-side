const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.567kdcn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const database = client.db("foodSharingDB");
        const foodsCollection = database.collection("foods");

        // POST API
        app.post("/foods", async (req, res) => {
            try {
                const foodItem = req.body;
                const result = await foodsCollection.insertOne(foodItem);
                res.status(201).send(result);
            } catch (error) {
                console.error("Error adding food item:", error);
                res.status(500).send({
                    message: "Failed to add food item",
                });
            }
        });

        // GET API
        app.get("/foods", async (req, res) => {
            try {
                const foods = await foodsCollection.find({}).toArray();
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({
                    message: "Failed to fetch food items",
                });
            }
        });
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
}
run();

// Basic route
app.get("/", (req, res) => {
    res.send("CUREE server is running!");
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
