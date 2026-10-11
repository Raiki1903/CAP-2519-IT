import type { Request, Response } from 'express';
import * as authService from './auth.service';
import { checkAccountUpdate, checkLogin, checkProfileQuery, checkRegistration, checkRegistrationRequest } from './auth.validation';
import { AppError } from '../../shared/errors/AppError';

/** Handles POST /api/auth/register. */
export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { firstName, lastName, email, password, idNumber, userType, centerId } = req.body;
        const data = { firstName, lastName, email, password, idNumber, userType, centerId };

        checkRegistration(data);
        const user = await authService.register(data);

        res.json({ success: true, user });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Registration error:", error);
        res.status(500).json({ success: false, error: error.message || "Registration failed." });
    }
}

/** Handles GET /api/auth/pending-registrations. */
export async function listPendingRegistrations(req: Request, res: Response): Promise<void> {
    res.json({ success: true, pendingRegistrations: authService.listPendingRegistrations() });
}

/** Handles POST /api/auth/register-request. */
export async function requestRegistration(req: Request, res: Response): Promise<void> {
    try {
        const { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl } = req.body;
        const data = { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl };

        checkRegistrationRequest(data);
        const newReq = await authService.requestRegistration(data);

        console.log(`📝 Registration request created for ${email} (Pending Lab Head Approval). ID: ${newReq.id}`);

        res.json({ success: true, registration: newReq });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Register request error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to submit registration request." });
    }
}

/** Handles POST /api/auth/approve-registration. */
export async function approveRegistration(req: Request, res: Response): Promise<void> {
    try {
        const { requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password } = req.body;

        const createdUser = await authService.approveRegistration({ requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password });

        console.log(`✅ Lab Head Approved User Registration! Created user in MySQL DB: ID ${createdUser.user_id} (${createdUser.email})`);
        res.json({ success: true, user: createdUser, message: `Account approved and created in database for ${createdUser.email}.` });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Approve registration error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to approve registration." });
    }
}

/** Handles POST /api/auth/login. */
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { email, password } = req.body;

        checkLogin({ email, password });
        const { role, user } = await authService.login(email, password);

        res.json({
            success: true,
            role,
            user
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Login authentication error:", error);
        res.status(500).json({ success: false, error: error.message || "Authentication error." });
    }
}

/** Handles POST /api/auth/reject-registration. */
export async function rejectRegistration(req: Request, res: Response): Promise<void> {
    try {
        const { requestId } = req.body;
        authService.rejectRegistration(requestId);
        res.json({ success: true, message: "Registration request rejected." });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/** Handles GET /api/auth/me. */
export async function getProfile(req: Request, res: Response): Promise<void> {
    try {
        const email = req.query.email as string;

        checkProfileQuery(email);
        const user = await authService.getProfile(email);

        res.json({
            success: true,
            user
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Fetch profile error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch user profile." });
    }
}

/** Handles PUT /api/auth/account. */
export async function updateAccount(req: Request, res: Response): Promise<void> {
    try {
        const { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = req.body;
        const data = { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture };

        checkAccountUpdate(data);
        const { updatedUser, user } = await authService.updateAccount(data);

        console.log(`👤 Updated user credentials in MySQL DB: ${updatedUser.email} -> ${firstName} ${lastName} (${labAffiliation}) [img length: ${updatedUser.user_img ? updatedUser.user_img.length : 0}]`);
        res.json({
            success: true,
            user
        });
    } catch (error: any) {
        if (error instanceof AppError) {
            res.status(error.status).json({ success: false, error: error.message });
            return;
        }
        console.error("❌ Update account error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update account details." });
    }
}
