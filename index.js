require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;
const decoded = Buffer.from(process.env.FB_SK, "base64").toString("utf-8");
// Initialize Firebase Admin SDK with environment variables
const serviceAccount = JSON.parse(decoded);
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// Middleware
const corsOptions = {
    origin: ["http://localhost:5173", "https://curee-web.web.app"],
    credentials: true,
    optionSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
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

const uri = process.env.MONGODB_URI;

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
        const orderCollection = database.collection("orders");

        // POST API All Foods
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

        // GET all foods (public)
        app.get("/all-foods", async (req, res) => {
            try {
                const search = req.query.search || "";
                let query = {};
                if (search) {
                    query = { foodName: { $regex: search, $options: "i" } };
                }
                const result = await foodsCollection.find(query).sort({ createdAt: -1 }).toArray();
                res.status(200).send({
                    success: true,
                    data: result,
                });
            } catch (error) {
                console.error("Error fetching foods:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to fetch food items",
                });
            }
        });

        // GET foods by email (protected)
        app.get("/my-foods/:email", verifyFbToken, async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    return res.status(400).send({ success: false, message: "Email query parameter is required" });
                }
                // Check if the requested email matches the authenticated user's email
                if (email !== req.user.email) {
                    return res.status(403).send({ success: false, message: "Forbidden access" });
                }
                const query = { "addedBy.email": email };
                const options = { sort: { createdAt: -1 } };
                const foods = await foodsCollection.find(query, options).toArray();
                return res.status(200).send({
                    success: true,
                    data: foods,
                });
            } catch (error) {
                console.error("Error fetching foods by email:", error);
                return res.status(500).send({
                    success: false,
                    message: "Failed to fetch food items by email",
                });
            }
        });

        // GET API for fetching single food item
        app.get("/food-detail/:id", async (req, res) => {
            const foodId = req.params.id;
            if (!ObjectId.isValid(foodId)) {
                return res.status(400).send({ success: false, message: "Invalid food id" });
            }
            const filter = { _id: new ObjectId(foodId) };
            try {
                const singleFood = await foodsCollection.findOne(filter);
                if (!singleFood) {
                    return res.status(404).send({ success: false, message: "Food Item not found" });
                }
                res.send(singleFood);
            } catch (error) {
                res.status(500).send({
                    success: false,
                    message: "Failed to fetch Food Item Data",
                    error: error.message,
                });
            }
        });

        // POST API for creating a new order
        app.post("/orders", verifyFbToken, async (req, res) => {
            try {
                const orderData = req.body;
                // Add createdAt timestamp
                const foodOrder = {
                    ...orderData,
                };
                const result = await orderCollection.insertOne(foodOrder);
                res.status(201).send({
                    success: true,
                    insertedId: result.insertedId,
                    message: "Order placed successfully",
                });
            } catch (error) {
                console.error("Error placing order:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to place order",
                });
            }
        });

        // PATCH API to update purchaseCount and quantity for a food item
        app.patch("/food-purchase/:id", verifyFbToken, async (req, res) => {
            const foodId = req.params.id;
            const { purchaseAmount = 1 } = req.body;
            if (!ObjectId.isValid(foodId)) {
                return res.status(400).send({ success: false, message: "Invalid food id" });
            }
            try {
                const filter = { _id: new ObjectId(foodId) };
                const food = await foodsCollection.findOne(filter);
                if (!food) {
                    return res.status(404).send({ success: false, message: "Food Item not found" });
                }
                // Check if enough quantity is available
                if (food.quantity < purchaseAmount) {
                    return res.status(400).send({ success: false, message: "Not enough quantity available" });
                }
                // Update purchaseCount and quantity
                const updateDoc = {
                    $inc: { purchaseCount: purchaseAmount, quantity: -purchaseAmount },
                };
                const result = await foodsCollection.updateOne(filter, updateDoc);
                if (result.modifiedCount === 0) {
                    return res.status(500).send({ success: false, message: "Failed to update food item" });
                }
                return res.status(200).send({ success: true, message: "Food item updated successfully" });
            } catch (error) {
                console.error("Error updating food item:", error);
                return res.status(500).send({ success: false, message: "Failed to update food item" });
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
