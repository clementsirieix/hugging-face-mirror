import { Request, Response, Router } from "express";

export async function getHealth(_req: Request, res: Response) {
    res.status(200).json({ status: "ok" });
}

const router = Router();

router.get("/", getHealth);

export default router;
