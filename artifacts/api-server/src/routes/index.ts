import { Router, type IRouter } from "express";
import healthRouter from "./health";
import unitsRouter from "./units";

const router: IRouter = Router();

router.use(healthRouter);
router.use(unitsRouter);

export default router;
