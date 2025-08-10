require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const port = process.env.PORT || 5000;
const app = express();

const decoded = Buffer.from(process.env.FB_SK, "base64").toString("utf-8");
// Initialize Firebase Admin SDK with environment variables
const serviceAccount = JSON.parse(decoded);
// Initialize Firebase Admin if not already initialized
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

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

const uri = `${process.env.MONGODB_URI}`;

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
        // await client.connect();
        // console.log("Connected to MongoDB!");

        const database = client.db("foodSharingDB");
        const foodsCollection = database.collection("foods");
        const orderCollection = database.collection("orders");

        // POST API for Contact Form Email
        app.post("/send-contact-email", async (req, res) => {
        try {
            const { userEmail, phoneNumber, message } = req.body;

            // Validate input
            if (!userEmail || !message) {
                return res.status(400).send({
                    success: false,
                    message: "Email and message are required",
                });
            }                // Create transporter for email sending
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });

                const mailOptions = {
                    from: `"CUREE Contact Form" <${process.env.EMAIL_USER}>`,
                    to: process.env.AGENT_EMAIL || "",
                    replyTo: userEmail, // Customer email for replies
                    subject: `🍽️ New Contact: ${userEmail}`,
                    text: `New contact form submission from: ${userEmail}${phoneNumber ? `\nPhone: ${phoneNumber}` : ''}\n\nMessage:\n${message}`,
                    html: `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>New Contact Form Submission</title>
                        </head>
                        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8f9fa;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                                <!-- Header -->
                                <div style="background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); padding: 30px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                                        🍽️ CUREE Restaurant
                                    </h1>
                                    <p style="color: #ffeb3b; margin: 5px 0 0 0; font-size: 14px;">
                                        New Customer Inquiry
                                    </p>
                                </div>
                                
                                <!-- Content -->
                                <div style="padding: 30px;">
                                    <!-- Alert Banner -->
                                    <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 20px;">
                                        <h2 style="color: #1565c0; margin: 0; font-size: 18px;">
                                            📧 New Contact Form Submission
                                        </h2>
                                    </div>
                                    
                                    <!-- Customer Information -->
                                    <div style="background-color: #f5f5f5; padding: 20px; margin-bottom: 20px;">
                                        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">
                                            👤 Customer Information
                                        </h3>
                                        <div style="background-color: #ffffff; padding: 15px; border-left: 3px solid #4caf50;">
                                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                                                <strong style="color: #333333;">Email:</strong> 
                                                <a href="mailto:${userEmail}" style="color: #d32f2f; text-decoration: none; font-weight: 500;">${userEmail}</a>
                                            </p>
                                            ${phoneNumber ? `<p style="margin: 0; color: #666666; font-size: 14px;">
                                                <strong style="color: #333333;">Phone:</strong> 
                                                <a href="tel:${phoneNumber}" style="color: #d32f2f; text-decoration: none; font-weight: 500;">${phoneNumber}</a>
                                            </p>` : ''}
                                        </div>
                                    </div>
                                    
                                    <!-- Message Content -->
                                    <div style="margin-bottom: 20px;">
                                        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">
                                            💬 Message Content
                                        </h3>
                                        <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px;">
                                            <p style="color: #444444; line-height: 1.6; font-size: 15px; margin: 0;">${message}</p>
                                        </div>
                                    </div>
                                    
                                    <!-- Action Buttons -->
                                    <div style="text-align: center; margin: 30px 0;">
                                        <a href="mailto:${userEmail}?subject=Re: Your inquiry to CUREE Restaurant" 
                                           style="display: inline-block; background-color: #d32f2f; color: #ffffff; padding: 12px 30px; text-decoration: none; margin: 0 10px; font-weight: 600;">
                                            📧 Reply to Customer
                                        </a>
                                        ${phoneNumber ? `<a href="tel:${phoneNumber}" 
                                           style="display: inline-block; background-color: #4caf50; color: #ffffff; padding: 12px 30px; text-decoration: none; margin: 0 10px; font-weight: 600;">
                                            📞 Call Customer
                                        </a>` : `<a href="tel:+999764886" 
                                           style="display: inline-block; background-color: #4caf50; color: #ffffff; padding: 12px 30px; text-decoration: none; margin: 0 10px; font-weight: 600;">
                                            📞 Call Restaurant
                                        </a>`}
                                    </div>
                                </div>
                                
                                <!-- Footer -->
                                <div style="background-color: #37474f; color: #ffffff; padding: 20px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; font-size: 14px;">
                                        <strong>CUREE Restaurant Management System</strong>
                                    </p>
                                    <p style="margin: 0; font-size: 12px;">
                                        📍 39/5 Zigatola (ground Floor), Dhanmondi, 1209, Dhaka<br>
                                        📞 +999 764 886 | +999 423 097
                                    </p>
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #546e7a;">
                                        <p style="margin: 0; font-size: 11px;">
                                            This email was automatically generated from the CUREE website contact form.<br>
                                            Received on: ${new Date().toLocaleString("en-US", {
                                                weekday: "long",
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `,
                };

                await transporter.sendMail(mailOptions);

                res.status(200).send({
                    success: true,
                    message: "Email sent successfully",
                });
            } catch (error) {
                console.error("Email sending failed:", error);
                res.status(500).send({
                    success: false,
                    message: "Failed to send email",
                });
            }
        });

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

        // PATCH API to update all food information for a food item
        app.patch("/my-food-update/:id", verifyFbToken, async (req, res) => {
            const foodId = req.params.id;
            const updateData = req.body;
            if (!ObjectId.isValid(foodId)) {
                return res.status(400).send({ success: false, message: "Invalid food id" });
            }
            try {
                const filter = { _id: new ObjectId(foodId) };
                if (updateData._id) {
                    delete updateData._id;
                }
                const updateDoc = { $set: updateData };
                const result = await foodsCollection.updateOne(filter, updateDoc);
                if (result.matchedCount === 0) {
                    return res.status(404).send({ success: false, message: "Food Item not found" });
                }
                if (result.modifiedCount === 0) {
                    return res.status(200).send({ success: true, message: "No changes made to the food item" });
                }
                return res.status(200).send({ success: true, message: "Food item updated successfully" });
            } catch (error) {
                console.error("Error updating food item:", error);
                return res.status(500).send({ success: false, message: "Failed to update food item" });
            }
        });

        // GET api to fetch orders by email
        app.get("/my-orders/:email", verifyFbToken, async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    return res.status(400).send({ success: false, message: "Email parameter is required" });
                }
                if (email !== req.user.email) {
                    return res.status(403).send({ success: false, message: "Forbidden access" });
                }
                const query = { buyerEmail: email };
                const orders = await orderCollection.find(query).toArray();
                return res.status(200).send({
                    success: true,
                    data: orders,
                });
            } catch (error) {
                console.error("Error fetching orders! ", error);
                return res.status(500).send({
                    success: false,
                    message: "Failed to fetch food orders!",
                });
            }
        });

        // DELETE api to delete an order by id
        app.delete("/orders/:id", verifyFbToken, async (req, res) => {
            const orderId = req.params.id;
            if (!ObjectId.isValid(orderId)) {
                return res.status(400).send({ success: false, message: "Invalid order id" });
            }
            try {
                const filter = { _id: new ObjectId(orderId) };
                const order = await orderCollection.findOne(filter);
                if (!order) {
                    return res.status(404).send({ success: false, message: "Order not found" });
                }
                // Only allow the buyer to delete own order
                if (order.buyerEmail !== req.user.email) {
                    return res
                        .status(403)
                        .send({ success: false, message: "Forbidden: You can only delete your own order" });
                }
                const result = await orderCollection.deleteOne(filter);
                if (result.deletedCount === 1) {
                    return res.status(200).send({ success: true, message: "Order deleted successfully" });
                } else {
                    return res.status(500).send({ success: false, message: "Failed to delete order" });
                }
            } catch (error) {
                console.error("Error deleting order:", error);
                return res.status(500).send({ success: false, message: "Failed to delete order" });
            }
        });
    } finally {
        // Ensures that the client will close when you finish/error
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
