
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        location: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        transport: {
            type: String,
            default: ""
        },
        type: {
            type: String,
            enum: ["Lost", "Found"],
            required: true
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Claimed", "Unclaimed", "Returned"],
            default: "Unclaimed"
        },
        imagePath: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

const Report = mongoose.model("Report", reportSchema);

module.exports = Report;
