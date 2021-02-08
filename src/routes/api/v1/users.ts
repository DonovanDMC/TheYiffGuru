import express from "express";
import db from "../../../db";

const app = express.Router();

app
	.get("/:id", async (req, res) => {
		const v = await db.get("user", {
			id: req.params.id
		});

		if (v === null) return res.status(404).json({
			success: false,
			error: "Unknown user."
		});

		return res.status(200).json({
			success: true,
			data: v.toJSON(false)
		});
	});

export default app;
