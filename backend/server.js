
// =============================================
// FINDIT - COMPLETE BACKEND SERVER
// =============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Report = require("./models/Report");
const User = require("./models/user");
const Claim = require("./models/Claim");

const app = express();

// =============================================
// CONFIGURATION
// =============================================

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();

// =============================================
// NOTIFICATION MODEL
// =============================================

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        title: {
            type: String,
            required: true
        },

        message: {
            type: String,
            required: true
        },

        type: {
            type: String,
            enum: ["Match", "Claim", "General"],
            default: "General"
        },

        relatedReport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            default: null
        },

        relatedClaim: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Claim",
            default: null
        },

        // NEW: Exact Lost report reference
        relatedLostReport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            default: null
        },

        // NEW: Exact Found report reference
        relatedFoundReport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            default: null
        },

        read: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const Notification =
    mongoose.models.Notification ||
    mongoose.model("Notification", notificationSchema);

// =============================================
// BASIC ROUTES
// =============================================

app.get("/", (req, res) => {
    res.send("FindIt Backend is Running Successfully!");
});

app.get("/api/test", async (req, res) => {
    res.json({
        success: true,

        message: "FindIt backend connected",

        database: mongoose.connection.readyState === 1
            ? "connected"
            : "disconnected",

        features: [
            "Authentication",
            "Lost and Found Reports",
            "Automatic Matching",
            "Ownership Claims",
            "Claim Approval and Rejection",
            "Item Return Management",
            "Notifications",
            "Exact Matching Item Navigation",
            "Admin Dashboard",
            "CSV Export"
        ]
    });
});

// =============================================
// TEXT MATCHING HELPERS
// =============================================

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getBigrams(value) {
    const text = normalizeText(value).replace(/\s/g, "");

    const result = new Set();

    for (let i = 0; i < text.length - 1; i++) {
        result.add(text.substring(i, i + 2));
    }

    return result;
}

function textSimilarity(first, second) {
    const a = normalizeText(first);
    const b = normalizeText(second);

    if (!a || !b) return 0;

    if (a === b) return 1;

    const wordsA = new Set(a.split(" "));
    const wordsB = new Set(b.split(" "));

    let commonWords = 0;

    for (const word of wordsA) {
        if (wordsB.has(word)) {
            commonWords++;
        }
    }

    const wordScore =
        (2 * commonWords) / (wordsA.size + wordsB.size);

    const pairsA = getBigrams(a);
    const pairsB = getBigrams(b);

    let commonPairs = 0;

    for (const pair of pairsA) {
        if (pairsB.has(pair)) {
            commonPairs++;
        }
    }

    const bigramScore =
        pairsA.size + pairsB.size === 0
            ? 0
            : (2 * commonPairs) / (pairsA.size + pairsB.size);

    return Math.max(wordScore, bigramScore);
}

// =============================================
// CALCULATE MATCH SCORE
// =============================================

function calculateMatchScore(lostItem, foundItem) {

    if (
        normalizeText(lostItem.category) !==
        normalizeText(foundItem.category)
    ) {
        return 0;
    }

    let score = 25;

    score += textSimilarity(
        lostItem.name,
        foundItem.name
    ) * 20;

    score += textSimilarity(
        lostItem.description,
        foundItem.description
    ) * 25;

    score += textSimilarity(
        lostItem.location,
        foundItem.location
    ) * 20;

    if (
        lostItem.transport &&
        foundItem.transport &&
        normalizeText(lostItem.transport) ===
        normalizeText(foundItem.transport)
    ) {
        score += 5;
    }

    if (
        lostItem.date &&
        foundItem.date &&
        new Date(lostItem.date).toDateString() ===
        new Date(foundItem.date).toDateString()
    ) {
        score += 5;
    }

    return Math.min(100, Math.round(score));
}

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

async function authenticateUser(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const token = header.split(" ")[1];

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found."
            });
        }

        req.user = user;
        req.userId = user._id;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired login session."
        });
    }
}

// =============================================
// ADMIN AUTHENTICATION
// =============================================

async function authenticateAdmin(req, res, next) {
    try {
        if (!ADMIN_EMAIL) {
            return res.status(500).json({
                success: false,
                message: "ADMIN_EMAIL is not configured."
            });
        }

        const header = req.headers.authorization;

        if (!header || !header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Admin login required."
            });
        }

        const token = header.split(" ")[1];

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (
            !user ||
            user.email.toLowerCase() !== ADMIN_EMAIL
        ) {
            return res.status(403).json({
                success: false,
                message: "Admin access denied."
            });
        }

        req.user = user;
        req.adminId = user._id;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin session."
        });
    }
}

// =============================================
// NOTIFICATION HELPER
// =============================================

async function createNotification(
    userId,
    title,
    message,
    type = "General",
    relatedReport = null,
    relatedClaim = null,
    relatedLostReport = null,
    relatedFoundReport = null
) {
    if (!userId) return;

    await Notification.create({
        user: userId,
        title,
        message,
        type,
        relatedReport,
        relatedClaim,
        relatedLostReport,
        relatedFoundReport
    });
}

// =============================================
// AUTH - REGISTER
// =============================================

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required."
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        const normalizedEmail = String(email)
            .trim()
            .toLowerCase();

        if (normalizedEmail === ADMIN_EMAIL) {
            return res.status(403).json({
                success: false,
                message: "This email is reserved for the administrator."
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: String(name).trim(),
            email: normalizedEmail,
            phone: phone || "",
            password: hashedPassword
        });

        res.status(201).json({
            success: true,
            message: "Registration successful.",

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isAdmin: user.email === ADMIN_EMAIL
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

// =============================================
// AUTH - LOGIN
// =============================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const normalizedEmail = String(email)
            .trim()
            .toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const passwordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const isAdmin = user.email === ADMIN_EMAIL;

        const token = jwt.sign(
            { userId: user._id.toString() },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                isAdmin
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

// =============================================
// GET LOGGED-IN USER PROFILE
// =============================================

app.get("/api/auth/me", authenticateUser, (req, res) => {
    res.json({
        success: true,

        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            isAdmin: req.user.email === ADMIN_EMAIL
        }
    });
});

// =============================================
// REPORT VALIDATION
// =============================================

function validateReport(body) {
    const {
        name,
        category,
        description,
        location,
        date,
        type
    } = body;

    if (
        !name ||
        !category ||
        !description ||
        !location ||
        !date ||
        !type
    ) {
        return "Please fill in all required report fields.";
    }

    if (!["Lost", "Found"].includes(type)) {
        return "Report type must be Lost or Found.";
    }

    if (Number.isNaN(new Date(date).getTime())) {
        return "Please enter a valid report date.";
    }

    return null;
}

// =============================================
// CREATE LOST / FOUND REPORT
// =============================================

app.post("/api/reports", authenticateUser, async (req, res) => {
    try {
        const validationError = validateReport(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const report = await Report.create({
            name: req.body.name,
            type: req.body.type,
            category: req.body.category,
            description: req.body.description,
            location: req.body.location,
            date: req.body.date,
            transport: req.body.transport || "",
            imageUrl: req.body.imageUrl || "",
            reportedBy: req.userId,
            status: "Unclaimed"
        });

        const oppositeType =
            report.type === "Lost" ? "Found" : "Lost";

        const otherReports = await Report.find({
            type: oppositeType,
            category: report.category,
            reportedBy: { $ne: req.userId },
            status: { $ne: "Returned" }
        });

        for (const other of otherReports) {

            const lostReport =
                report.type === "Lost" ? report : other;

            const foundReport =
                report.type === "Found" ? report : other;

            const score = calculateMatchScore(
                lostReport,
                foundReport
            );

            if (score >= 35) {

                // Notification to the person who submitted
                // the latest report.

                await createNotification(
                    report.reportedBy,
                    "Possible Match Found!",
                    `A possible match was found for your ${report.type.toLowerCase()} report.`,
                    "Match",
                    report._id,
                    null,
                    lostReport._id,
                    foundReport._id
                );

                // Notification to the owner of the
                // previously submitted opposite report.

                await createNotification(
                    other.reportedBy,
                    "Possible Match Found!",
                    "A new report may match one of your reported items.",
                    "Match",
                    other._id,
                    null,
                    lostReport._id,
                    foundReport._id
                );
            }
        }

        res.status(201).json({
            success: true,
            message: "Report submitted successfully.",
            report
        });

    } catch (error) {
        console.error("Create report error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit report."
        });
    }
});

// =============================================
// GET ALL REPORTS
// =============================================

app.get("/api/reports", async (req, res) => {
    try {
        const {
            type,
            category,
            location,
            date,
            keyword
        } = req.query;

        const filter = {};

        if (type) filter.type = type;

        if (category) filter.category = category;

        if (location) {
            filter.location = {
                $regex: String(location),
                $options: "i"
            };
        }

        if (date) {
            const start = new Date(date);
            const end = new Date(date);

            end.setDate(end.getDate() + 1);

            filter.date = {
                $gte: start,
                $lt: end
            };
        }

        if (keyword) {
            const regex = {
                $regex: String(keyword),
                $options: "i"
            };

            filter.$or = [
                { name: regex },
                { description: regex },
                { location: regex },
                { category: regex }
            ];
        }

        const reports = await Report.find(filter)
            .populate("reportedBy", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: reports.length,
            reports
        });

    } catch (error) {
        console.error("Load reports error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load reports."
        });
    }
});

// =============================================
// GET REPORTS BY TYPE
// =============================================

app.get("/api/reports/type/:type", async (req, res) => {
    try {
        const type = req.params.type;

        if (!["Lost", "Found"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid report type."
            });
        }

        const reports = await Report.find({ type })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            reports
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load reports."
        });
    }
});

// =============================================
// GET MY REPORTS
// =============================================

app.get("/api/reports/my", authenticateUser, async (req, res) => {
    try {
        const reports = await Report.find({
            reportedBy: req.userId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            reports
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load your reports."
        });
    }
});

// =============================================
// EDIT OWN REPORT
// =============================================

app.patch("/api/reports/:id", authenticateUser, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID."
            });
        }

        const report = await Report.findOne({
            _id: req.params.id,
            reportedBy: req.userId
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found or you do not own it."
            });
        }

        if (["Claimed", "Returned"].includes(report.status)) {
            return res.status(400).json({
                success: false,
                message: "This report cannot be edited now."
            });
        }

        const allowedFields = [
            "name",
            "category",
            "description",
            "location",
            "date",
            "transport",
            "imageUrl"
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                report[field] = req.body[field];
            }
        }

        await report.save();

        res.json({
            success: true,
            message: "Report updated successfully.",
            report
        });

    } catch (error) {
        console.error("Edit report error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update report."
        });
    }
});

// =============================================
// DELETE OWN REPORT
// =============================================

app.delete("/api/reports/:id", authenticateUser, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid report ID."
            });
        }

        const report = await Report.findOne({
            _id: req.params.id,
            reportedBy: req.userId
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Report not found or you do not own it."
            });
        }

        if (["Claimed", "Returned"].includes(report.status)) {
            return res.status(400).json({
                success: false,
                message: "Claimed or returned reports cannot be deleted."
            });
        }

        const approvedClaim = await Claim.findOne({
            $or: [
                { lostReport: report._id },
                { foundReport: report._id }
            ],
            status: "Approved"
        });

        if (approvedClaim) {
            return res.status(400).json({
                success: false,
                message: "This report is linked to an approved claim."
            });
        }

        const relatedClaims = await Claim.find({
            $or: [
                { lostReport: report._id },
                { foundReport: report._id }
            ]
        });

        const affectedFoundIds = relatedClaims.map(
            claim => claim.foundReport
        );

        await Claim.deleteMany({
            $or: [
                { lostReport: report._id },
                { foundReport: report._id }
            ]
        });

        await Notification.deleteMany({
            $or: [
                { relatedReport: report._id },
                { relatedLostReport: report._id },
                { relatedFoundReport: report._id }
            ]
        });

        await Report.findByIdAndDelete(report._id);

        for (const foundId of affectedFoundIds) {

            const remainingClaim = await Claim.findOne({
                foundReport: foundId,
                status: { $in: ["Pending", "Approved"] }
            });

            if (!remainingClaim) {
                await Report.updateOne(
                    { _id: foundId, status: "Pending" },
                    { $set: { status: "Unclaimed" } }
                );
            }
        }

        res.json({
            success: true,
            message: "Your report was deleted successfully."
        });

    } catch (error) {
        console.error("Delete report error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete report."
        });
    }
});

// =============================================
// BUILD POSSIBLE MATCHES
// =============================================

async function buildMatches() {

    // Claimed reports remain visible.
    // Only returned reports are excluded.

    const lostItems = await Report.find({
        type: "Lost",
        status: { $ne: "Returned" }
    });

    const foundItems = await Report.find({
        type: "Found",
        status: { $ne: "Returned" }
    });

    const matches = [];

    for (const lostItem of lostItems) {

        for (const foundItem of foundItems) {

            if (
                lostItem.reportedBy &&
                foundItem.reportedBy &&
                lostItem.reportedBy.toString() ===
                foundItem.reportedBy.toString()
            ) {
                continue;
            }

            const matchScore = calculateMatchScore(
                lostItem,
                foundItem
            );

            if (matchScore >= 35) {

                matches.push({
                    lostItem,
                    foundItem,
                    matchScore
                });

            }
        }
    }

    matches.sort(
        (a, b) => b.matchScore - a.matchScore
    );

    return matches;
}

// =============================================
// PUBLIC MATCHES
// =============================================

app.get("/api/matches", async (req, res) => {
    try {
        const matches = await buildMatches();

        res.json({
            success: true,
            count: matches.length,
            matches
        });

    } catch (error) {
        console.error("Match error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to generate matches."
        });
    }
});

// =============================================
// USER SUBMITS OWNERSHIP CLAIM
// =============================================

app.post("/api/claims", authenticateUser, async (req, res) => {
    try {
        const {
            lostReportId,
            foundReportId,
            reason
        } = req.body;

        if (
            !mongoose.isValidObjectId(lostReportId) ||
            !mongoose.isValidObjectId(foundReportId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid report IDs."
            });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                success: false,
                message: "Please explain why you believe this is your item."
            });
        }

        const lostReport = await Report.findById(lostReportId);
        const foundReport = await Report.findById(foundReportId);

        if (
            !lostReport ||
            !foundReport ||
            lostReport.type !== "Lost" ||
            foundReport.type !== "Found"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid Lost and Found report pair."
            });
        }

        if (
            lostReport.reportedBy.toString() !==
            req.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "Only the owner of the Lost report can submit this claim."
            });
        }

        if (
            foundReport.reportedBy.toString() ===
            req.userId.toString()
        ) {
            return res.status(400).json({
                success: false,
                message: "You cannot claim your own Found report."
            });
        }

        if (["Claimed", "Returned"].includes(foundReport.status)) {
            return res.status(400).json({
                success: false,
                message: "This found item is no longer available."
            });
        }

        const existingClaim = await Claim.findOne({
            lostReport: lostReportId,
            foundReport: foundReportId
        });

        if (existingClaim) {
            return res.status(409).json({
                success: false,
                message: "A claim already exists for these reports."
            });
        }

        const claim = await Claim.create({
            lostReport: lostReportId,
            foundReport: foundReportId,
            claimant: req.userId,
            reason: String(reason).trim(),
            status: "Pending"
        });

        if (foundReport.status === "Unclaimed") {
            foundReport.status = "Pending";
            await foundReport.save();
        }

        await createNotification(
            foundReport.reportedBy,
            "Ownership claim received",
            "A passenger has submitted an ownership claim for your found item. Please wait for admin verification.",
            "Claim",
            foundReport._id,
            claim._id
        );

        await createNotification(
            req.userId,
            "Claim submitted",
            "Your ownership claim has been sent to the admin for verification.",
            "Claim",
            lostReport._id,
            claim._id
        );

        res.status(201).json({
            success: true,
            message: "Ownership claim submitted successfully.",
            claim
        });

    } catch (error) {
        console.error("Claim creation error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit ownership claim."
        });
    }
});

// =============================================
// GET MY CLAIMS
// =============================================

app.get("/api/claims/my", authenticateUser, async (req, res) => {
    try {
        const claims = await Claim.find({
            claimant: req.userId
        })
            .populate("lostReport")
            .populate("foundReport")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            claims
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load claims."
        });
    }
});

// =============================================
// USER NOTIFICATIONS
// =============================================

app.get("/api/notifications", authenticateUser, async (req, res) => {
    try {
        const notifications = await Notification.find({
            user: req.userId
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: notifications.length,
            notifications
        });

    } catch (error) {
        console.error("Notification error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load notifications."
        });
    }
});

// =============================================
// MARK NOTIFICATION AS READ
// =============================================

app.patch(
    "/api/notifications/:id/read",
    authenticateUser,
    async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid notification ID."
                });
            }

            const notification = await Notification.findOneAndUpdate(
                {
                    _id: req.params.id,
                    user: req.userId
                },
                { read: true },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found."
                });
            }

            res.json({
                success: true,
                notification
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Unable to update notification."
            });
        }
    }
);

// =============================================
// ADMIN DASHBOARD STATISTICS
// =============================================

app.get("/api/admin/dashboard", authenticateAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalLost,
            totalFound,
            totalClaims,
            pendingClaims,
            approvedClaims,
            rejectedClaims,
            returnedItems
        ] = await Promise.all([
            User.countDocuments(),

            Report.countDocuments({
                type: "Lost"
            }),

            Report.countDocuments({
                type: "Found"
            }),

            Claim.countDocuments(),

            Claim.countDocuments({
                status: "Pending"
            }),

            Claim.countDocuments({
                status: "Approved"
            }),

            Claim.countDocuments({
                status: "Rejected"
            }),

            Report.countDocuments({
                type: "Found",
                status: "Returned"
            })
        ]);

        res.json({
            success: true,
            totalUsers,
            totalLost,
            totalFound,
            totalClaims,
            pendingClaims,
            approvedClaims,
            rejectedClaims,
            returnedItems
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load dashboard statistics."
        });
    }
});

// =============================================
// ADMIN - VIEW USERS
// =============================================

app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            users
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load users."
        });
    }
});

// =============================================
// ADMIN - VIEW ALL REPORTS
// =============================================

app.get("/api/admin/reports", authenticateAdmin, async (req, res) => {
    try {
        const reports = await Report.find()
            .populate("reportedBy", "name email phone")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            reports
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load admin reports."
        });
    }
});

// =============================================
// ADMIN - VIEW MATCHES
// =============================================

app.get("/api/admin/matches", authenticateAdmin, async (req, res) => {
    try {
        const matches = await buildMatches();

        res.json({
            success: true,
            count: matches.length,
            matches
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load matches."
        });
    }
});

// =============================================
// ADMIN - VIEW CLAIMS
// =============================================

app.get("/api/admin/claims", authenticateAdmin, async (req, res) => {
    try {
        const claims = await Claim.find()
            .populate("lostReport")
            .populate("foundReport")
            .populate("claimant", "name email phone")
            .populate("reviewedBy", "name email")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            claims
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to load claims."
        });
    }
});

// =============================================
// ADMIN - APPROVE OR REJECT CLAIM
// =============================================

app.patch(
    "/api/admin/claims/:id",
    authenticateAdmin,
    async (req, res) => {
        try {
            const { decision, adminNote } = req.body;

            if (!["Approved", "Rejected"].includes(decision)) {
                return res.status(400).json({
                    success: false,
                    message: "Decision must be Approved or Rejected."
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid claim ID."
                });
            }

            const claim = await Claim.findById(req.params.id);

            if (!claim) {
                return res.status(404).json({
                    success: false,
                    message: "Claim not found."
                });
            }

            if (claim.status !== "Pending") {
                return res.status(400).json({
                    success: false,
                    message: "This claim has already been reviewed."
                });
            }

            const foundReport = await Report.findById(
                claim.foundReport
            );

            const lostReport = await Report.findById(
                claim.lostReport
            );

            if (!foundReport || !lostReport) {
                return res.status(404).json({
                    success: false,
                    message: "Associated report not found."
                });
            }

            if (decision === "Approved") {

                if (
                    ["Claimed", "Returned"].includes(foundReport.status)
                ) {
                    return res.status(409).json({
                        success: false,
                        message: "This item is already claimed or returned."
                    });
                }

                const anotherApproved = await Claim.findOne({
                    foundReport: foundReport._id,
                    status: "Approved",
                    _id: { $ne: claim._id }
                });

                if (anotherApproved) {
                    return res.status(409).json({
                        success: false,
                        message: "Another claim has already been approved."
                    });
                }

                foundReport.status = "Claimed";

                await foundReport.save();
            }

            claim.status = decision;
            claim.adminNote = adminNote || "";
            claim.reviewedBy = req.adminId;
            claim.reviewedAt = new Date();

            await claim.save();

            if (decision === "Rejected") {

                const remainingClaim = await Claim.findOne({
                    foundReport: foundReport._id,
                    status: { $in: ["Pending", "Approved"] },
                    _id: { $ne: claim._id }
                });

                if (
                    !remainingClaim &&
                    foundReport.status === "Pending"
                ) {
                    foundReport.status = "Unclaimed";
                    await foundReport.save();
                }
            }

            await createNotification(
                claim.claimant,
                `Claim ${decision.toLowerCase()}`,
                decision === "Approved"
                    ? "Your ownership claim has been approved by the admin. The item can now proceed to the return process."
                    : `Your ownership claim was rejected. Admin note: ${adminNote || "No additional note."}`,
                "Claim",
                lostReport._id,
                claim._id
            );

            await createNotification(
                foundReport.reportedBy,
                `Claim ${decision.toLowerCase()}`,
                decision === "Approved"
                    ? "The ownership claim for your found item has been approved."
                    : "The ownership claim for your found item was rejected.",
                "Claim",
                foundReport._id,
                claim._id
            );

            res.json({
                success: true,
                message: `Claim ${decision.toLowerCase()} successfully.`,
                claim
            });

        } catch (error) {
            console.error("Claim review error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to review claim."
            });
        }
    }
);

// =============================================
// ADMIN - MARK APPROVED CLAIM AS RETURNED
// =============================================

app.patch(
    "/api/admin/claims/:id/return",
    authenticateAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!mongoose.isValidObjectId(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid claim ID."
                });
            }

            const claim = await Claim.findById(id);

            if (!claim) {
                return res.status(404).json({
                    success: false,
                    message: "Claim not found."
                });
            }

            if (claim.status !== "Approved") {
                return res.status(400).json({
                    success: false,
                    message: "Only approved claims can be marked as returned."
                });
            }

            const lostReport = await Report.findById(
                claim.lostReport
            );

            const foundReport = await Report.findById(
                claim.foundReport
            );

            if (!lostReport || !foundReport) {
                return res.status(404).json({
                    success: false,
                    message: "Associated reports not found."
                });
            }

            if (
                lostReport.status === "Returned" &&
                foundReport.status === "Returned"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "This item has already been returned."
                });
            }

            if (foundReport.status !== "Claimed") {
                return res.status(400).json({
                    success: false,
                    message: "The found item must be claimed before return."
                });
            }

            foundReport.status = "Returned";
            lostReport.status = "Returned";

            await foundReport.save();
            await lostReport.save();

            await createNotification(
                claim.claimant,
                "Item returned successfully",
                "The administrator has confirmed that your claimed item has been returned.",
                "Claim",
                lostReport._id,
                claim._id
            );

            await createNotification(
                foundReport.reportedBy,
                "Item return confirmed",
                "The administrator has confirmed the return of your found item.",
                "Claim",
                foundReport._id,
                claim._id
            );

            res.json({
                success: true,
                message: "Item marked as returned successfully.",
                claim,
                lostReport,
                foundReport
            });

        } catch (error) {
            console.error("Return item error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to mark item as returned."
            });
        }
    }
);

// =============================================
// ADMIN - UPDATE REPORT STATUS
// =============================================

app.patch(
    "/api/admin/reports/:id/status",
    authenticateAdmin,
    async (req, res) => {
        try {
            const allowedStatuses = [
                "Pending",
                "Claimed",
                "Unclaimed",
                "Returned"
            ];

            const { status } = req.body;

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid report status."
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid report ID."
                });
            }

            const report = await Report.findById(req.params.id);

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found."
                });
            }

            if (status === "Returned") {

                const approvedClaim = await Claim.findOne({
                    $or: [
                        { lostReport: report._id },
                        { foundReport: report._id }
                    ],
                    status: "Approved"
                });

                if (!approvedClaim) {
                    return res.status(400).json({
                        success: false,
                        message: "Approve an ownership claim before marking this item as returned."
                    });
                }

                return res.status(400).json({
                    success: false,
                    message: "Use the Mark as Returned action on the approved claim."
                });
            }

            if (status === "Claimed") {

                const approvedClaim = await Claim.findOne({
                    $or: [
                        { lostReport: report._id },
                        { foundReport: report._id }
                    ],
                    status: "Approved"
                });

                if (!approvedClaim) {
                    return res.status(400).json({
                        success: false,
                        message: "An approved ownership claim is required."
                    });
                }
            }

            report.status = status;

            await report.save();

            res.json({
                success: true,
                message: "Report status updated.",
                report
            });

        } catch (error) {
            console.error("Status update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update status."
            });
        }
    }
);

// =============================================
// ADMIN - CSV EXPORT
// =============================================

function csvEscape(value) {
    let text = String(value ?? "");

    if (/^[=+\-@\t\r]/.test(text)) {
        text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

function createCSV(headers, rows) {
    return [
        headers.map(csvEscape).join(","),
        ...rows.map(row => row.map(csvEscape).join(","))
    ].join("\n");
}

app.get(
    "/api/admin/export/:type",
    authenticateAdmin,
    async (req, res) => {
        try {
            const type = req.params.type;

            let csv = "";
            let filename = "";

            if (type === "items") {

                const reports = await Report.find()
                    .populate("reportedBy", "name email");

                csv = createCSV(
                    [
                        "Name",
                        "Type",
                        "Category",
                        "Description",
                        "Location",
                        "Date",
                        "Transport",
                        "Status",
                        "Reported By"
                    ],

                    reports.map(report => [
                        report.name,
                        report.type,
                        report.category,
                        report.description,
                        report.location,
                        report.date,
                        report.transport,
                        report.status,
                        report.reportedBy?.name
                    ])
                );

                filename = "findit-reports.csv";

            } else if (type === "claims") {

                const claims = await Claim.find()
                    .populate("claimant", "name email");

                csv = createCSV(
                    [
                        "Claimant",
                        "Email",
                        "Reason",
                        "Status",
                        "Admin Note",
                        "Created At"
                    ],

                    claims.map(claim => [
                        claim.claimant?.name,
                        claim.claimant?.email,
                        claim.reason,
                        claim.status,
                        claim.adminNote,
                        claim.createdAt
                    ])
                );

                filename = "findit-claims.csv";

            } else if (type === "users") {

                const users = await User.find()
                    .select("-password");

                csv = createCSV(
                    [
                        "Name",
                        "Email",
                        "Phone",
                        "Registered At"
                    ],

                    users.map(user => [
                        user.name,
                        user.email,
                        user.phone,
                        user.createdAt
                    ])
                );

                filename = "findit-users.csv";

            } else {

                return res.status(400).json({
                    success: false,
                    message: "Invalid export type."
                });
            }

            res.setHeader(
                "Content-Type",
                "text/csv; charset=utf-8"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );

            res.send("\uFEFF" + csv);

        } catch (error) {
            console.error("CSV export error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to export data."
            });
        }
    }
);

// =============================================
// START SERVER
// =============================================

async function startServer() {
    try {

        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET is missing in .env");
        }

        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing in .env");
        }

        if (!ADMIN_EMAIL) {
            throw new Error("ADMIN_EMAIL is missing in .env");
        }

        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB Atlas connected successfully!");

        app.listen(PORT, () => {
            console.log(
                `FindIt server running at http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);
    }
}

startServer();
