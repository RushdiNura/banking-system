import express from "express";
import {
  createAccount,
  getAccounts,
  getAccount,
  getAccountByNumber,
  updateAccount,
  closeAccount,
  getAccountSummary,
  getAccountStatement,
  addBeneficiary,
  getBeneficiaries,
  removeBeneficiary,
} from "../controllers/accountController.js";
import {
  protect,
  authorize,
  // requireVerified,
  requireKYC,
} from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);
// router.use(requireVerified);

// Account routes
router.route("/").get(getAccounts).post(requireKYC, createAccount);

router.get("/number/:accountNumber", getAccountByNumber);

router.route("/:id").get(getAccount).put(updateAccount).delete(closeAccount);

// Summary and statement
router.get("/:id/summary", getAccountSummary);
router.get("/:id/statement", getAccountStatement);

// Beneficiary routes
router.route("/:id/beneficiaries").get(getBeneficiaries).post(addBeneficiary);

router.delete("/:id/beneficiaries/:beneficiaryId", removeBeneficiary);

export default router;
