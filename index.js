require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;
const decoded = Buffer.from(process.env.FB_SK, "base64").toString("utf-8");
// Initialize Firebase Admin SDK with environment variables
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Token Verification Middleware
const verifyFbToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ success: false, message: "Unauthorized Access" });
        }

        const accessToken = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
        const decodedToken = await admin.auth().verifyIdToken(accessToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).send({ success: false, message: "Invalid or expired token" });
    }
};

const uri = process.env.MONGODB_URI

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

        // POST API - My Foods
        app.post("/foods", verifyFbToken, async (req, res) => {
            try {
                const foodItem = req.body;
                const foodAdd = {
                    ...foodItem,
                    createdAt: new Date(),
                    addedBy: {
                        ...foodItem.addedBy,
                        email: req.user.email,
                    },
                };
                const result = await foodsCollection.insertOne(foodAdd);
                res.status(201).send({
                    success: true,
                    insertedId: result.insertedId,
                    message: "Food item added successfully",
                });
            } catch (error) {
                console.error("Error adding food item:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to add food item",
                });
            }
        });

        // GET API
        app.get("/foods", async (req, res) => {
            try {
                const { email } = req.query;

                // If requesting foods by email, verify token and check authorization
                if (email) {
                    try {
                        const authHeader = req.headers.authorization;

                        if (!authHeader || !authHeader.startsWith("Bearer ")) {
                            return res.status(401).send({ success: false, message: "Unauthorized Access" });
                        }

                        const accessToken = authHeader && authHeader.split(" ")[1];
                        const decodedToken = await admin.auth().verifyIdToken(accessToken);

                        // Check if the requested email matches the authenticated user's email
                        if (email !== decodedToken.email) {
                            return res.status(403).send({ success: false, message: "Forbidden access" });
                        }

                        const query = { "addedBy.email": email };
                        const options = { sort: { createdAt: -1 } };

                        const foods = await foodsCollection.find(query, options).toArray();
                        return res.status(200).send({
                            success: true,
                            data: foods,
                        });
                    } catch (tokenError) {
                        console.error("Token verification error:", tokenError);
                        return res.status(403).send({
                            success: false,
                            message: "Invalid or expired token",
                        });
                    }
                }

                // Public route - get all foods
                const foods = await foodsCollection.find({}).sort({ createdAt: -1 }).toArray();
                res.status(200).send({
                    success: true,
                    data: foods,
                });
            } catch (error) {
                console.error("Error fetching foods:", error);
                res.status(500).send({
                    success: false,
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
