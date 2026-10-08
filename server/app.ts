import express from 'express';
import cors from 'cors';
import { router as remainingRoutes } from './remainingRoutes';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(remainingRoutes);
