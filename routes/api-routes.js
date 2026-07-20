const express = require("express");
const router = express.Router();
let userController = require("../controllers/userController");
let adminController = require("../controllers/adminController");

const auth = require("../config/auth");

/* ============================================================
   ============================================================
                       USER ROUTES
   ============================================================
   ============================================================ */

/* ============== USER - PUBLIC (no token) ============== */
router.post("/signup", userController.createUser);
router.post("/send-otp", userController.sendOtp);
router.post("/verify-otp", userController.verifyOtp);
router.post("/login", userController.loginWithPassword);
router.get("/categories", userController.getCategories);

/* ============== USER - STORIES ============== */
router.get("/stories-new", userController.getStoriesNewForApp);
router.get("/story-new/:id", userController.getStoryNewForApp);
router.post("/submit-story-new", userController.submitStoryNew);
router.post("/complete-story-new", userController.completeStoryNew);

/* ============== USER - PROFILE ============== */
router.post("/profile", userController.getProfile);
router.put("/profile", userController.updateProfile);
router.put("/change-password", userController.changePassword);
router.delete("/delete-account", userController.deleteAccount);

/* ============== USER - PROFILE ============== */
router.get("/coin-invest/:userId", userController.getCoinInvest);
router.post("/submit-coin-invest", userController.submitCoinInvest);
/* ============== USER - SM PRACTICE LAB ============== */
router.get("/sm-practice-lab", userController.getSmPracticeLabFlow);
router.post("/submit-sm-practice-lab", userController.submitSmPracticeLab);
router.get(
  "/sm-practice-lab-categories/:power",
  userController.getSmPracticeLabCategories,
);
router.get(
  "/sm-practice-lab-power/:userId",
  userController.getSmPracticeLabPowersForApp,
);

/* ============== USER - STORIES (browse) ============== */
router.get("/home/:userId", userController.getHomeFeed);
router.get("/stories", userController.getStoriesByCategory);
router.get("/search-stories", userController.searchStories);
router.get("/story/:storyId", userController.getStoryDetails);

/* ============== USER - MY STORIES ============== */
router.get("/my-stories", userController.getMyStories);
router.post("/my-stories", userController.createMyStory);
router.put("/my-stories/:storyId", userController.updateMyStory);
router.delete("/my-stories/:storyId", userController.deleteMyStory);

/* ============== USER - FAVORITES ============== */
router.get("/favorites", userController.getFavorites);
router.post("/favorites/:storyId", userController.toggleFavorite);

/* ============== USER - READING PROGRESS ============== */
router.get("/reading-history/:userId", userController.getReadingHistory);
router.post("/save-reading-progress", userController.saveReadingProgress);

/* ============== USER - MORNING ============== */
router.get("/morning/flow/:userId", userController.getMorningFlow);
router.post("/morning/complete", userController.completeMorning);
router.get("/evening/flow/:userId", userController.getEveningFlow);
router.post("/evening/complete", userController.completeEvening);

/* ============== Treasure Hunt  ============== */
router.get("/treasure-hunt", userController.getTreasureHunt);
router.post("/submit-treasure-hunt", userController.submitTreasureHunt);
/* ============================================================
   ============================================================
                       ADMIN ROUTES
   ============================================================
   ============================================================ */

/* ============== ADMIN - AUTH (no token for login) ============== */
router.post("/admin/login", adminController.adminLogin);

/* ============== ADMIN - PROFILE ============== */
router.put("/admin/change-password", adminController.changeAdminPassword);
router.put("/admin/profile", adminController.updateAdminProfile);

/* ============== ADMIN - DASHBOARD ============== */
router.get("/admin/dashboard/overview", adminController.getDashboardOverview);
router.get("/admin/dashboard/recent-stories", adminController.getRecentStories);

/* ============== ADMIN - STORIES ============== */
router.post("/admin/add-story", adminController.addStory);
router.get("/admin/stories", adminController.getAllStories);
router.post(
  "/admin/generatePresignedUrl",
  adminController.generatePresignedUrl,
);
router.get("/admin/story/:storyId", adminController.getStoryById);
router.put("/admin/update-story/:storyId", adminController.updateStory);
router.delete("/admin/delete-story/:storyId", adminController.deleteStory);
router.patch("/admin/story-status/:storyId", adminController.changeStoryStatus);

/* ============== ADMIN - CATEGORIES ============== */
router.get("/admin/categories", adminController.getAllCategories);
router.get("/admin/category/:categoryId", adminController.getCategoryById);
router.post("/admin/add-category", adminController.addCategory);
router.post("/admin/category", adminController.addCategory);
router.put("/admin/category/:id", adminController.updateCategory);
router.delete("/admin/category/:id", adminController.deleteCategory);
router.get("/admin/category-details/:id", adminController.getCategoryDetails);

/* ============== ADMIN - SUBCATEGORIES (embedded in category) ============== */
router.post("/admin/category/:id/subcategory", adminController.addSubcategory);
router.put(
  "/admin/category/:id/subcategory/:subId",
  adminController.updateSubcategory,
);
router.delete(
  "/admin/category/:id/subcategory/:subId",
  adminController.deleteSubcategory,
);
router.post(
  "/admin/category/:id/subcategories-reorder",
  adminController.reorderSubcategories,
);

/* ============== ADMIN - USERS ============== */
router.get("/admin/users", adminController.getAllUsers);
router.get("/admin/user/:userId", adminController.getUserById);
router.patch("/admin/suspend-user/:userId", adminController.suspendUser);
router.delete("/admin/delete-user/:userId", adminController.deleteUser);

/* ============================================================
   ============================================================
                 SUSTAINABLE MIND - ADMIN
   ============================================================
   ============================================================ */

/* ============== SM - RESPONSIBILITY MANAGEMENT ============== */
router.post("/admin/add-responsibility", adminController.addResponsibility);
router.get("/admin/responsibilities", adminController.getAllResponsibilities);
router.get("/admin/responsibility/:id", adminController.getResponsibilityById);
router.put(
  "/admin/update-responsibility/:id",
  adminController.updateResponsibility,
);
router.delete(
  "/admin/delete-responsibility/:id",
  adminController.deleteResponsibility,
);
router.get(
  "/admin/responsibility-categories",
  adminController.getResponsibilityCategories,
);
router.post(
  "/admin/responsibility-category",
  adminController.addResponsibilityCategory,
);

/* ============== SM - HELPFUL ACTIONS ============== */
router.post("/admin/add-helpful-action", adminController.addHelpfulAction);
router.get("/admin/helpful-actions", adminController.getAllHelpfulActions);
router.get("/admin/helpful-action/:id", adminController.getHelpfulActionById);
router.put(
  "/admin/update-helpful-action/:id",
  adminController.updateHelpfulAction,
);
router.delete(
  "/admin/delete-helpful-action/:id",
  adminController.deleteHelpfulAction,
);
router.get(
  "/admin/helpful-action-categories",
  adminController.getHelpfulActionCategories,
);
router.post(
  "/admin/helpful-action-category",
  adminController.addHelpfulActionCategory,
);

/* ============== SM - PENDING SUGGESTIONS ============== */
router.get("/admin/pending-suggestions", adminController.getPendingSuggestions);
router.delete(
  "/admin/delete-pending-suggestion/:id",
  adminController.deletePendingSuggestion,
);
router.patch(
  "/admin/accept-pending-suggestion/:id",
  adminController.acceptPendingSuggestion,
);

/* ============== SM - GREETING CHALLENGE ============== */
router.post("/admin/add-greeting", adminController.addGreeting);
router.get("/admin/greetings", adminController.getAllGreetings);
router.get("/admin/greeting/:id", adminController.getGreetingById);
router.put("/admin/update-greeting/:id", adminController.updateGreeting);
router.delete("/admin/delete-greeting/:id", adminController.deleteGreeting);

/* ============== SM - GROWTH FOCUS ============== */
router.post("/admin/add-growth-focus", adminController.addGrowthFocus);
router.get("/admin/growth-focus", adminController.getAllGrowthFocus);
router.get("/admin/growth-focus/:id", adminController.getGrowthFocusById);
router.put("/admin/update-growth-focus/:id", adminController.updateGrowthFocus);
router.delete(
  "/admin/delete-growth-focus/:id",
  adminController.deleteGrowthFocus,
);

/* ============== SM - GROWTH FOCUS CATEGORY ============== */
router.post(
  "/admin/add-growth-focus-category",
  adminController.addGrowthFocusCategory,
);
router.get(
  "/admin/growth-focus-categories",
  adminController.getAllGrowthFocusCategories,
);
router.get(
  "/admin/growth-focus-category/:id",
  adminController.getGrowthFocusCategoryById,
);
router.put(
  "/admin/update-growth-focus-category/:id",
  adminController.updateGrowthFocusCategory,
);
router.delete(
  "/admin/delete-growth-focus-category/:id",
  adminController.deleteGrowthFocusCategory,
);

/* ============== SM - GROWTH FOCUS SITUATION ============== */
router.post(
  "/admin/add-growth-focus-situation",
  adminController.addGrowthFocusSituation,
);
router.get(
  "/admin/growth-focus-situations",
  adminController.getAllGrowthFocusSituations,
);
router.get(
  "/admin/growth-focus-situation/:id",
  adminController.getGrowthFocusSituationById,
);
router.put(
  "/admin/update-growth-focus-situation/:id",
  adminController.updateGrowthFocusSituation,
);
router.delete(
  "/admin/delete-growth-focus-situation/:id",
  adminController.deleteGrowthFocusSituation,
);

/* ============== SM - PRACTICE LAB CATEGORY ============== */
router.post(
  "/admin/add-practice-lab-category",
  adminController.addPracticeLabCategory,
);
router.get(
  "/admin/practice-lab-categories",
  adminController.getAllPracticeLabCategories,
);
router.get(
  "/admin/practice-lab-category/:id",
  adminController.getPracticeLabCategoryById,
);
router.put(
  "/admin/update-practice-lab-category/:id",
  adminController.updatePracticeLabCategory,
);
router.delete(
  "/admin/delete-practice-lab-category/:id",
  adminController.deletePracticeLabCategory,
);

/* ============== SM - PRACTICE LAB SITUATION ============== */
router.post(
  "/admin/add-practice-lab-situation",
  adminController.addPracticeLabSituation,
);
router.get(
  "/admin/practice-lab-situations",
  adminController.getAllPracticeLabSituations,
);
router.get(
  "/admin/practice-lab-situation/:id",
  adminController.getPracticeLabSituationById,
);
router.put(
  "/admin/update-practice-lab-situation/:id",
  adminController.updatePracticeLabSituation,
);
router.delete(
  "/admin/delete-practice-lab-situation/:id",
  adminController.deletePracticeLabSituation,
);
router.get("/admin/gallery", adminController.getGalleryImages);
router.post("/admin/gallery", adminController.addGalleryImage);

router.put(
  "/admin/update-responsibility-category/:id",
  adminController.updateResponsibilityCategory,
);
router.delete(
  "/admin/delete-responsibility-category/:id",
  adminController.deleteResponsibilityCategory,
);

router.get(
  "/admin/helpful-action-categories",
  adminController.getHelpfulActionCategories,
);
router.post(
  "/admin/helpful-action-category",
  adminController.addHelpfulActionCategory,
);
router.put(
  "/admin/update-helpful-action-category/:id",
  adminController.updateHelpfulActionCategory,
);
router.delete(
  "/admin/delete-helpful-action-category/:id",
  adminController.deleteHelpfulActionCategory,
);
router.post("/admin/add-gratitude-pause", adminController.addGratitudePause);
router.get("/admin/gratitude-pause", adminController.getAllGratitudePause);
router.get("/admin/gratitude-pause/:id", adminController.getGratitudePauseById);
router.put(
  "/admin/update-gratitude-pause/:id",
  adminController.updateGratitudePause,
);
router.delete(
  "/admin/delete-gratitude-pause/:id",
  adminController.deleteGratitudePause,
);
router.post(
  "/admin/bulk-add-growth-focus-situations",
  adminController.bulkAddGrowthFocusSituations,
);
router.post(
  "/admin/bulk-add-practice-lab-situations",
  adminController.bulkAddPracticeLabSituations,
);
// ---------- SM Practice Lab - Categories ----------
router.get(
  "/admin/sm-practice-lab-categories",
  adminController.getAllSmPracticeLabCategories,
);
router.post(
  "/admin/add-sm-practice-lab-category",
  adminController.addSmPracticeLabCategory,
);
router.get(
  "/admin/sm-practice-lab-category/:id",
  adminController.getSmPracticeLabCategoryById,
);
router.put(
  "/admin/update-sm-practice-lab-category/:id",
  adminController.updateSmPracticeLabCategory,
);
router.delete(
  "/admin/delete-sm-practice-lab-category/:id",
  adminController.deleteSmPracticeLabCategory,
);

// ---------- SM Practice Lab - Situations ----------
router.get(
  "/admin/sm-practice-lab-situations",
  adminController.getAllSmPracticeLabSituations,
);
router.post(
  "/admin/add-sm-practice-lab-situation",
  adminController.addSmPracticeLabSituation,
);
router.post(
  "/admin/bulk-add-sm-practice-lab-situations",
  adminController.bulkAddSmPracticeLabSituations,
);
router.get(
  "/admin/sm-practice-lab-situation/:id",
  adminController.getSmPracticeLabSituationById,
);
router.put(
  "/admin/update-sm-practice-lab-situation/:id",
  adminController.updateSmPracticeLabSituation,
);
router.delete(
  "/admin/delete-sm-practice-lab-situation/:id",
  adminController.deleteSmPracticeLabSituation,
);
router.post(
  "/admin/add-sm-practice-lab-power",
  adminController.addSmPracticeLabPower,
);
router.get(
  "/admin/sm-practice-lab-powers",
  adminController.getAllSmPracticeLabPowers,
);
router.get(
  "/admin/sm-practice-lab-power/:id",
  adminController.getSmPracticeLabPowerById,
);
router.put(
  "/admin/update-sm-practice-lab-power/:id",
  adminController.updateSmPracticeLabPower,
);
router.delete(
  "/admin/delete-sm-practice-lab-power/:id",
  adminController.deleteSmPracticeLabPower,
);
// ---------- Story----------

router.post("/admin/add-story-new", adminController.addStoryNew);
router.get("/admin/stories-new", adminController.getAllStoriesNew);
router.get("/admin/story-new/:id", adminController.getStoryNewById);
router.put("/admin/update-story-new/:id", adminController.updateStoryNew);
router.delete("/admin/delete-story-new/:id", adminController.deleteStoryNew);

// ---------- SM Practice Lab - App side ----------
router.get(
  "/sm-practice-lab-old",
  adminController.getSmPracticeLabSituationForApp,
);
module.exports = router;
