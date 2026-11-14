
const mongoose = require("mongoose");

const claimSchema = new mongoose.Schema(
    {
        lostReport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            required: true
        },
        foundReport: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Report",
            required: true
        },
        claimant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },
        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending"
        },
        adminNote: {
            type: String,
            default: ""
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

claimSchema.index(
    { lostReport: 1, foundReport: 1 },
    { unique: true }
);

module.exports = mongoose.model("Claim", claimSchema);
