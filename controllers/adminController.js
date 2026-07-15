let adminService = require("../services/adminServices");

// helper for the Sustainable Mind handlers (keeps them compact)
const handle = (promise, res) =>
  promise
    .then((r) => res.status(r.status || 200).send(r))
    .catch((e) =>
      res.status(e.status || 500).send({
        status: e.status || 500,
        message: e.message ? e.message : "Internal server error.",
        data: e.data || [],
      }),
    );

module.exports = {
  /* ============================================================
     AUTH
     ============================================================ */

  adminLogin: (req, res, next) => {
    adminService
      .adminLogin(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  generatePresignedUrl: (req, res, next) => {
    adminService
      .generatePresignedUrl(req.body)
      .then((result) => {
        if (result && result.status === 200) {
          res.status(result.status || 200).send(result);
        } else {
          res.status(result.status || 400).send(result);
        }
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: [],
        });
      });
  },

  changeAdminPassword: (req, res, next) => {
    adminService
      .changeAdminPassword(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  updateAdminProfile: (req, res, next) => {
    adminService
      .updateAdminProfile(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     STORIES
     ============================================================ */

  addStory: (req, res, next) => {
    adminService
      .addStory(req.body)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getAllStories: (req, res) => {
    adminService
      .getAllStories({
        status: req.query.status,
        categoryId: req.query.categoryId,
        search: req.query.search,
        sort: req.query.sort,
        limit: req.query.limit,
        lastId: req.query.lastId,
      })
      .then((r) => res.status(r.status || 200).send(r))
      .catch((e) =>
        res.status(e.status || 500).send({
          status: e.status || 500,
          message: e.message,
          data: e.data || [],
        }),
      );
  },

  getStoryById: (req, res, next) => {
    adminService
      .getStoryById({ storyId: req.params.storyId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  updateStory: (req, res, next) => {
    adminService
      .updateStory({ storyId: req.params.storyId, ...req.body })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  deleteStory: (req, res, next) => {
    adminService
      .deleteStory({ storyId: req.params.storyId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  changeStoryStatus: (req, res, next) => {
    adminService
      .changeStoryStatus({
        storyId: req.params.storyId,
        status: req.body.status,
      })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     CATEGORIES
     ============================================================ */

  addCategory: (req, res, next) => {
    adminService
      .addCategory(req.body)
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  updateCategory: (req, res, next) => {
    adminService
      .updateCategory({
        ...req.body,
        categoryId: req.params.id || req.body.categoryId,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  deleteCategory: (req, res, next) => {
    adminService
      .deleteCategory({ categoryId: req.params.id })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  getCategoryDetails: (req, res, next) => {
    adminService
      .getCategoryDetails({ categoryId: req.params.id })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  getAllCategories: (req, res, next) => {
    adminService
      .getAllCategories()
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getCategoryById: (req, res, next) => {
    adminService
      .getCategoryById({ categoryId: req.params.categoryId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     SUBCATEGORIES (embedded in parent category)
     ============================================================ */

  addSubcategory: (req, res, next) => {
    adminService
      .addSubcategory({
        categoryId: req.params.id,
        name: req.body.name,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  updateSubcategory: (req, res, next) => {
    adminService
      .updateSubcategory({
        categoryId: req.params.id,
        subcategoryId: req.params.subId,
        name: req.body.name,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  deleteSubcategory: (req, res, next) => {
    adminService
      .deleteSubcategory({
        categoryId: req.params.id,
        subcategoryId: req.params.subId,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  reorderSubcategories: (req, res, next) => {
    adminService
      .reorderSubcategories({
        categoryId: req.params.id,
        orderedIds: req.body.orderedIds,
      })
      .then((result) => res.status(result.status || 200).send(result))
      .catch((err) =>
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message || "Internal server error.",
          data: err.data || [],
        }),
      );
  },

  /* ============================================================
     USERS
     ============================================================ */

  getAllUsers: (req, res) => {
    adminService
      .getAllUsers({
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit,
        lastId: req.query.lastId,
      })
      .then((r) => res.status(r.status || 200).send(r))
      .catch((e) =>
        res.status(e.status || 500).send({
          status: e.status || 500,
          message: e.message,
          data: e.data || [],
        }),
      );
  },

  getUserById: (req, res, next) => {
    adminService
      .getUserById({ userId: req.params.userId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  suspendUser: (req, res, next) => {
    adminService
      .suspendUser({ userId: req.params.userId, suspend: req.body.suspend })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  deleteUser: (req, res, next) => {
    adminService
      .deleteUser({ userId: req.params.userId })
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     DASHBOARD / ANALYTICS
     ============================================================ */

  getDashboardOverview: (req, res, next) => {
    adminService
      .getDashboardOverview()
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  getRecentStories: (req, res, next) => {
    adminService
      .getRecentStories(req.query)
      .then((result) => {
        res.status(result.status || 200).send(result);
      })
      .catch((err) => {
        res.status(err.status || 500).send({
          status: err.status || 500,
          message: err.message ? err.message : "Internal server error.",
          data: err.data || [],
        });
      });
  },

  /* ============================================================
     ============================================================
     SUSTAINABLE MIND
     ============================================================
     ============================================================ */

  /* ---------- RESPONSIBILITY MANAGEMENT ---------- */
  addResponsibility: (req, res) =>
    handle(adminService.addResponsibility(req.body), res),
  getAllResponsibilities: (req, res) =>
    handle(adminService.getAllResponsibilities(req.query), res),
  getResponsibilityById: (req, res) =>
    handle(
      adminService.getResponsibilityById({ responsibilityId: req.params.id }),
      res,
    ),
  updateResponsibility: (req, res) =>
    handle(
      adminService.updateResponsibility({
        responsibilityId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteResponsibility: (req, res) =>
    handle(
      adminService.deleteResponsibility({ responsibilityId: req.params.id }),
      res,
    ),
  getResponsibilityCategories: (req, res) =>
    handle(adminService.getResponsibilityCategories(), res),
  addResponsibilityCategory: (req, res) =>
    handle(adminService.addResponsibilityCategory(req.body), res),

  /* ---------- HELPFUL ACTIONS ---------- */
  addHelpfulAction: (req, res) =>
    handle(adminService.addHelpfulAction(req.body), res),
  getAllHelpfulActions: (req, res) =>
    handle(adminService.getAllHelpfulActions(req.query), res),
  getHelpfulActionById: (req, res) =>
    handle(adminService.getHelpfulActionById({ actionId: req.params.id }), res),
  updateHelpfulAction: (req, res) =>
    handle(
      adminService.updateHelpfulAction({
        actionId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteHelpfulAction: (req, res) =>
    handle(adminService.deleteHelpfulAction({ actionId: req.params.id }), res),
  getHelpfulActionCategories: (req, res) =>
    handle(adminService.getHelpfulActionCategories(), res),
  addHelpfulActionCategory: (req, res) =>
    handle(adminService.addHelpfulActionCategory(req.body), res),

  /* ---------- PENDING SUGGESTIONS ---------- */
  getPendingSuggestions: (req, res) =>
    handle(adminService.getPendingSuggestions(req.query), res),
  deletePendingSuggestion: (req, res) =>
    handle(
      adminService.deletePendingSuggestion({ suggestionId: req.params.id }),
      res,
    ),
  acceptPendingSuggestion: (req, res) =>
    handle(
      adminService.acceptPendingSuggestion({ suggestionId: req.params.id }),
      res,
    ),

  /* ---------- GREETING CHALLENGE ---------- */
  addGreeting: (req, res) => handle(adminService.addGreeting(req.body), res),
  getAllGreetings: (req, res) =>
    handle(adminService.getAllGreetings(req.query), res),
  getGreetingById: (req, res) =>
    handle(adminService.getGreetingById({ greetingId: req.params.id }), res),
  updateGreeting: (req, res) =>
    handle(
      adminService.updateGreeting({ greetingId: req.params.id, ...req.body }),
      res,
    ),
  deleteGreeting: (req, res) =>
    handle(adminService.deleteGreeting({ greetingId: req.params.id }), res),

  /* ---------- GROWTH FOCUS ---------- */
  addGrowthFocus: (req, res) =>
    handle(adminService.addGrowthFocus(req.body), res),
  getAllGrowthFocus: (req, res) =>
    handle(adminService.getAllGrowthFocus(req.query), res),
  getGrowthFocusById: (req, res) =>
    handle(
      adminService.getGrowthFocusById({ growthFocusId: req.params.id }),
      res,
    ),
  updateGrowthFocus: (req, res) =>
    handle(
      adminService.updateGrowthFocus({
        growthFocusId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteGrowthFocus: (req, res) =>
    handle(
      adminService.deleteGrowthFocus({ growthFocusId: req.params.id }),
      res,
    ),

  /* ---------- GROWTH FOCUS CATEGORY ---------- */
  addGrowthFocusCategory: (req, res) =>
    handle(adminService.addGrowthFocusCategory(req.body), res),
  getAllGrowthFocusCategories: (req, res) =>
    handle(adminService.getAllGrowthFocusCategories(req.query), res),
  getGrowthFocusCategoryById: (req, res) =>
    handle(
      adminService.getGrowthFocusCategoryById({ categoryId: req.params.id }),
      res,
    ),
  updateGrowthFocusCategory: (req, res) =>
    handle(
      adminService.updateGrowthFocusCategory({
        categoryId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteGrowthFocusCategory: (req, res) =>
    handle(
      adminService.deleteGrowthFocusCategory({ categoryId: req.params.id }),
      res,
    ),

  /* ---------- GROWTH FOCUS SITUATION ---------- */
  addGrowthFocusSituation: (req, res) =>
    handle(adminService.addGrowthFocusSituation(req.body), res),
  getAllGrowthFocusSituations: (req, res) =>
    handle(adminService.getAllGrowthFocusSituations(req.query), res),
  getGrowthFocusSituationById: (req, res) =>
    handle(
      adminService.getGrowthFocusSituationById({ situationId: req.params.id }),
      res,
    ),
  updateGrowthFocusSituation: (req, res) =>
    handle(
      adminService.updateGrowthFocusSituation({
        situationId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteGrowthFocusSituation: (req, res) =>
    handle(
      adminService.deleteGrowthFocusSituation({ situationId: req.params.id }),
      res,
    ),

  /* ---------- PRACTICE LAB CATEGORY ---------- */
  addPracticeLabCategory: (req, res) =>
    handle(adminService.addPracticeLabCategory(req.body), res),
  getAllPracticeLabCategories: (req, res) =>
    handle(adminService.getAllPracticeLabCategories(req.query), res),
  getPracticeLabCategoryById: (req, res) =>
    handle(
      adminService.getPracticeLabCategoryById({ categoryId: req.params.id }),
      res,
    ),
  updatePracticeLabCategory: (req, res) =>
    handle(
      adminService.updatePracticeLabCategory({
        categoryId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deletePracticeLabCategory: (req, res) =>
    handle(
      adminService.deletePracticeLabCategory({ categoryId: req.params.id }),
      res,
    ),

  /* ---------- PRACTICE LAB SITUATION ---------- */
  addPracticeLabSituation: (req, res) =>
    handle(adminService.addPracticeLabSituation(req.body), res),
  getAllPracticeLabSituations: (req, res) =>
    handle(adminService.getAllPracticeLabSituations(req.query), res),
  getPracticeLabSituationById: (req, res) =>
    handle(
      adminService.getPracticeLabSituationById({ situationId: req.params.id }),
      res,
    ),
  updatePracticeLabSituation: (req, res) =>
    handle(
      adminService.updatePracticeLabSituation({
        situationId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deletePracticeLabSituation: (req, res) =>
    handle(
      adminService.deletePracticeLabSituation({ situationId: req.params.id }),
      res,
    ),
  addGalleryImage: (req, res) =>
    handle(adminService.addGalleryImage(req.body), res),
  getGalleryImages: (req, res) =>
    handle(adminService.getGalleryImages(req.query), res),
  updateResponsibilityCategory: (req, res) =>
    handle(
      adminService.updateResponsibilityCategory({
        categoryId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteResponsibilityCategory: (req, res) =>
    handle(
      adminService.deleteResponsibilityCategory({ categoryId: req.params.id }),
      res,
    ),
  updateHelpfulActionCategory: (req, res) =>
    handle(
      adminService.updateHelpfulActionCategory({
        categoryId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteHelpfulActionCategory: (req, res) =>
    handle(
      adminService.deleteHelpfulActionCategory({ categoryId: req.params.id }),
      res,
    ),

  /* ---------- GRATITUDE PAUSE ---------- */
  addGratitudePause: (req, res) =>
    handle(adminService.addGratitudePause(req.body), res),
  getAllGratitudePause: (req, res) =>
    handle(adminService.getAllGratitudePause(req.query), res),
  getGratitudePauseById: (req, res) =>
    handle(
      adminService.getGratitudePauseById({ gratitudeId: req.params.id }),
      res,
    ),
  updateGratitudePause: (req, res) =>
    handle(
      adminService.updateGratitudePause({
        gratitudeId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteGratitudePause: (req, res) =>
    handle(
      adminService.deleteGratitudePause({ gratitudeId: req.params.id }),
      res,
    ),
  bulkAddGrowthFocusSituations: (req, res) =>
    handle(adminService.bulkAddGrowthFocusSituations(req.body), res),
  bulkAddPracticeLabSituations: (req, res) =>
    handle(adminService.bulkAddPracticeLabSituations(req.body), res),

  // ---------- SM Practice Lab - Categories ----------
  addSmPracticeLabCategory: (req, res) =>
    handle(adminService.addSmPracticeLabCategory(req.body), res),
  getAllSmPracticeLabCategories: (req, res) =>
    handle(adminService.getAllSmPracticeLabCategories(req.query), res),
  getSmPracticeLabCategoryById: (req, res) =>
    handle(
      adminService.getSmPracticeLabCategoryById({ categoryId: req.params.id }),
      res,
    ),
  updateSmPracticeLabCategory: (req, res) =>
    handle(
      adminService.updateSmPracticeLabCategory({
        categoryId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteSmPracticeLabCategory: (req, res) =>
    handle(
      adminService.deleteSmPracticeLabCategory({ categoryId: req.params.id }),
      res,
    ),

  // ---------- SM Practice Lab - Situations ----------
  addSmPracticeLabSituation: (req, res) =>
    handle(adminService.addSmPracticeLabSituation(req.body), res),
  bulkAddSmPracticeLabSituations: (req, res) =>
    handle(adminService.bulkAddSmPracticeLabSituations(req.body), res),
  getAllSmPracticeLabSituations: (req, res) =>
    handle(adminService.getAllSmPracticeLabSituations(req.query), res),
  getSmPracticeLabSituationById: (req, res) =>
    handle(
      adminService.getSmPracticeLabSituationById({
        situationId: req.params.id,
      }),
      res,
    ),
  updateSmPracticeLabSituation: (req, res) =>
    handle(
      adminService.updateSmPracticeLabSituation({
        situationId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  deleteSmPracticeLabSituation: (req, res) =>
    handle(
      adminService.deleteSmPracticeLabSituation({
        situationId: req.params.id,
        ...req.body,
      }),
      res,
    ),
  getSmPracticeLabSituationForApp: (req, res) =>
    handle(adminService.getSmPracticeLabSituationForApp(), res),
};
