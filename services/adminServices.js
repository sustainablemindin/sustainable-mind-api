const { getDb } = require("../dbConfig/dbConnection");
const { ObjectId } = require("mongodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

/* ============================================================
   AUTH
   ============================================================ */
const RM = "responsibility_management";
const RC = "responsibility_categories";
const HA = "helpful-actions";
const HAC = "helpful-action-categories";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const FRIENDS = ["blaze", "shello", "champ", "tejix"];

const buildScreens = (screens) => {
  if (!Array.isArray(screens)) return [];
  return screens.map((s) => {
    const base = {
      _id: s._id ? String(s._id) : new ObjectId().toString(),
      type: String(s.type || "").trim(),
    };

    switch (base.type) {
      case "story":
        return {
          ...base,
          heading: str(s.heading),
          bodyText: str(s.bodyText),
          images: arr(s.images).map(str),
          audioUrl: str(s.audioUrl),
          tejixText: str(s.tejixText),
        };
      case "realLife":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          bodyText: str(s.bodyText),
          image: str(s.image),
          audioUrl: str(s.audioUrl),
          tejixText: str(s.tejixText),
        };
      case "mcq":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          subtitle: str(s.subtitle),
          image: str(s.image),
          options: arr(s.options).map((o) => ({
            key: str(o.key),
            text: str(o.text),
          })),
          correct: str(s.correct),
          smKeyReward: num(s.smKeyReward),
          tejixText: str(s.tejixText),
        };
      case "insight":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          image: str(s.image),
          bodyText: str(s.bodyText),
          treasures: arr(s.treasures).map((t) => ({
            icon: str(t.icon),
            label: str(t.label),
            variant: str(t.variant) || "lost",
          })),
        };
      case "multiSelect":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          subtitle: str(s.subtitle),
          image: str(s.image),
          options: arr(s.options).map((o) => ({
            key: str(o.key),
            icon: str(o.icon),
            label: str(o.label),
          })),
          correct: arr(s.correct).map(str),
          smKeyReward: num(s.smKeyReward),
          tejixText: str(s.tejixText),
        };
      case "unlock":
        return {
          ...base,
          heading: str(s.heading),
          subtitle: str(s.subtitle),
          powerNumber: num(s.powerNumber),
          stepGrid: {
            total: num(s.stepGrid && s.stepGrid.total),
            current: num(s.stepGrid && s.stepGrid.current),
          },
          treasureEarned: str(s.treasureEarned),
          rewards: {
            smKeys: num(s.rewards && s.rewards.smKeys),
            badges: num(s.rewards && s.rewards.badges),
            heartPoints: num(s.rewards && s.rewards.heartPoints),
          },
        };
      case "checklist":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          image: str(s.image),
          items: arr(s.items).map((i) => ({
            label: str(i.label),
            checked: i.checked === true,
          })),
          tejixText: str(s.tejixText),
        };
      case "summary":
        return {
          ...base,
          label: str(s.label),
          heading: str(s.heading),
          summaryIntro: str(s.summaryIntro),
          points: arr(s.points).map(str),
          ladder: arr(s.ladder).map((l) => ({
            number: num(l.number),
            label: str(l.label),
          })),
          tejixText: str(s.tejixText),
        };
      default:
        return base; // unknown type - kept minimal, admin should not send this
    }
  });
};

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v) => (Number(v) > 0 || Number(v) === 0 ? Number(v) : 0);
const arr = (v) => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------- create
const addStoryNew = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }

    const doc = {
      title: str(data.title),
      author: str(data.author),
      status: data.status === "published" ? "published" : "draft",
      coverImage: str(data.coverImage),
      summary: str(data.summary),
      power: str(data.power),
      powerNumber: num(data.powerNumber),
      subtitle: str(data.subtitle),
      ageGroup: str(data.ageGroup),
      category: str(data.category),
      tags: arr(data.tags).map(str),
      treasureEarned: str(data.treasureEarned),
      rewards: {
        smKeys: num(data.rewards && data.rewards.smKeys),
        badges: num(data.rewards && data.rewards.badges),
        heartPoints: num(data.rewards && data.rewards.heartPoints),
      },
      order: num(data.order),
      isActive: data.isActive !== undefined ? data.isActive : true,
      screens: buildScreens(data.screens),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.collection("stories-new")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Story created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create story",
          data: [],
          error: e.message,
        }),
      );
  });
};

// ---------------------------------------------------------------- list
const getAllStoriesNew = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters && filters.power) query.power = filters.power;
    if (filters && filters.status) query.status = filters.status;

    const page = Number(filters && filters.page) > 0 ? Number(filters.page) : 1;
    const limit =
      Number(filters && filters.limit) > 0 ? Number(filters.limit) : 10;
    const skip = (page - 1) * limit;

    const col = db.collection("stories-new");

    col
      .countDocuments(query)
      .then((total) => {
        return (
          col
            .find(query)
            // list view is light - skip the heavy screens array
            .project({ screens: 0 })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray()
            .then((items) =>
              resolve({
                status: 200,
                message: "Stories fetched",
                data: items,
                pagination: {
                  total: total,
                  page: page,
                  limit: limit,
                  totalPages: Math.ceil(total / limit) || 1,
                },
              }),
            )
        );
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch stories",
          data: [],
          error: e.message,
        }),
      );
  });
};

// ---------------------------------------------------------------- read one
const getStoryNewById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories-new")
      .findOne({ _id: new ObjectId(data.storyId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Story fetched", data: [r] })
          : reject({ status: 404, message: "Story not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch story",
          data: [],
          error: e.message,
        }),
      );
  });
};

// ---------------------------------------------------------------- update
const updateStoryNew = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };

    if (data.title !== undefined) updates.title = str(data.title);
    if (data.author !== undefined) updates.author = str(data.author);
    if (data.status !== undefined)
      updates.status = data.status === "published" ? "published" : "draft";
    if (data.coverImage !== undefined)
      updates.coverImage = str(data.coverImage);
    if (data.summary !== undefined) updates.summary = str(data.summary);
    if (data.power !== undefined) updates.power = str(data.power);
    if (data.powerNumber !== undefined)
      updates.powerNumber = num(data.powerNumber);
    if (data.subtitle !== undefined) updates.subtitle = str(data.subtitle);
    if (data.ageGroup !== undefined) updates.ageGroup = str(data.ageGroup);
    if (data.category !== undefined) updates.category = str(data.category);
    if (data.tags !== undefined) updates.tags = arr(data.tags).map(str);
    if (data.treasureEarned !== undefined)
      updates.treasureEarned = str(data.treasureEarned);
    if (data.rewards !== undefined)
      updates.rewards = {
        smKeys: num(data.rewards && data.rewards.smKeys),
        badges: num(data.rewards && data.rewards.badges),
        heartPoints: num(data.rewards && data.rewards.heartPoints),
      };
    if (data.order !== undefined) updates.order = num(data.order);
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.screens !== undefined)
      updates.screens = buildScreens(data.screens);

    db.collection("stories-new")
      .updateOne({ _id: new ObjectId(data.storyId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Story updated", data: [] })
          : reject({ status: 404, message: "Story not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update story",
          data: [],
          error: e.message,
        }),
      );
  });
};

// ---------------------------------------------------------------- delete
const deleteStoryNew = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories-new")
      .deleteOne({ _id: new ObjectId(data.storyId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Story deleted", data: [] })
          : reject({ status: 404, message: "Story not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete story",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addSmPracticeLabPower = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim()) {
      return reject({
        status: 400,
        message: "Power name is required",
        data: [],
      });
    }
    const doc = {
      name: data.name.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("sm-practice-lab-power")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Power created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create power",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllSmPracticeLabPowers = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("sm-practice-lab-power")
      .find(query)
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Powers fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch powers",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getSmPracticeLabPowerById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-power")
      .findOne({ _id: new ObjectId(data.powerId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Power fetched", data: [r] })
          : reject({ status: 404, message: "Power not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch power",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateSmPracticeLabPower = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("sm-practice-lab-power")
      .updateOne({ _id: new ObjectId(data.powerId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Power updated", data: [] })
          : reject({ status: 404, message: "Power not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update power",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteSmPracticeLabPower = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-power")
      .deleteOne({ _id: new ObjectId(data.powerId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Power deleted", data: [] })
          : reject({ status: 404, message: "Power not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete power",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addSmPracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim()) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }
    const doc = {
      name: data.name.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("sm-practice-lab-category")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllSmPracticeLabCategories = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("sm-practice-lab-category")
      .find(query)
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Categories fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getSmPracticeLabCategoryById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-category")
      .findOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Category fetched", data: [r] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateSmPracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("sm-practice-lab-category")
      .updateOne({ _id: new ObjectId(data.categoryId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Category updated", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteSmPracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-category")
      .deleteOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Category deleted", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addSmPracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    if (!data.situation || !data.situation.trim()) {
      return reject({
        status: 400,
        message: "Situation is required",
        data: [],
      });
    }
    if (!data.power || !data.power.trim()) {
      return reject({ status: 400, message: "Power is required", data: [] });
    }
    if (!data.category || !data.category.trim()) {
      return reject({ status: 400, message: "Category is required", data: [] });
    }
    if (!(Number(data.smKeyReward) > 0)) {
      return reject({
        status: 400,
        message: "Reward must be greater than 0",
        data: [],
      });
    }
    const missing = FRIENDS.find((f) => !data[f] || !String(data[f]).trim());
    if (missing) {
      return reject({
        status: 400,
        message: `${missing} response is required`,
        data: [],
      });
    }
    if (!data.tejixInsight || !String(data.tejixInsight).trim()) {
      return reject({
        status: 400,
        message: "Tejix Insight is required",
        data: [],
      });
    }

    const doc = {
      situationId: data.situationId ? String(data.situationId).trim() : "",
      power: data.power.trim(),
      category: data.category.trim(),
      level: data.level ? String(data.level).trim() : "",
      ageGroup: data.ageGroup ? String(data.ageGroup).trim() : "",
      situation: data.situation.trim(),
      smKeyReward: Number(data.smKeyReward),
      blaze: String(data.blaze).trim(),
      shello: String(data.shello).trim(),
      champ: String(data.champ).trim(),
      tejix: String(data.tejix).trim(),
      tejixInsight: String(data.tejixInsight).trim(),
      hiddenTopic: data.hiddenTopic ? String(data.hiddenTopic).trim() : "",
      lifeSkill: data.lifeSkill ? String(data.lifeSkill).trim() : "",
      primaryEmotion: data.primaryEmotion
        ? String(data.primaryEmotion).trim()
        : "",
      indriya: data.indriya ? String(data.indriya).trim() : "",
      gitaChapters: data.gitaChapters ? String(data.gitaChapters).trim() : "",
      chapter2Psychology: data.chapter2Psychology
        ? String(data.chapter2Psychology).trim()
        : "",
      threeGunas: data.threeGunas ? String(data.threeGunas).trim() : "",
      dashavatara: data.dashavatara ? String(data.dashavatara).trim() : "",
      treasure: data.treasure ? String(data.treasure).trim() : "",
      focusAreas: data.focusAreas ? String(data.focusAreas).trim() : "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.collection("sm-practice-lab-situation")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Situation created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const bulkAddSmPracticeLabSituations = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return reject({ status: 400, message: "No items to import", data: [] });
    }

    const now = new Date();
    const docs = [];
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];

      if (!it.situation || !String(it.situation).trim()) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: situation is required`,
          data: [],
        });
      }
      if (!it.power || !String(it.power).trim()) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: power is required`,
          data: [],
        });
      }
      if (!it.category || !String(it.category).trim()) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: category is required`,
          data: [],
        });
      }
      if (!(Number(it.smKeyReward) > 0)) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: reward must be greater than 0`,
          data: [],
        });
      }
      const missing = FRIENDS.find((f) => !it[f] || !String(it[f]).trim());
      if (missing) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: ${missing} response is required`,
          data: [],
        });
      }
      if (!it.tejixInsight || !String(it.tejixInsight).trim()) {
        return reject({
          status: 400,
          message: `Row ${i + 1}: Tejix Insight is required`,
          data: [],
        });
      }

      docs.push({
        situationId: it.situationId ? String(it.situationId).trim() : "",
        power: String(it.power).trim(),
        category: String(it.category).trim(),
        level: it.level ? String(it.level).trim() : "",
        ageGroup: it.ageGroup ? String(it.ageGroup).trim() : "",
        situation: String(it.situation).trim(),
        smKeyReward: Number(it.smKeyReward),
        blaze: String(it.blaze).trim(),
        shello: String(it.shello).trim(),
        champ: String(it.champ).trim(),
        tejix: String(it.tejix).trim(),
        tejixInsight: String(it.tejixInsight).trim(),
        hiddenTopic: it.hiddenTopic ? String(it.hiddenTopic).trim() : "",
        lifeSkill: it.lifeSkill ? String(it.lifeSkill).trim() : "",
        primaryEmotion: it.primaryEmotion
          ? String(it.primaryEmotion).trim()
          : "",
        indriya: it.indriya ? String(it.indriya).trim() : "",
        gitaChapters: it.gitaChapters ? String(it.gitaChapters).trim() : "",
        chapter2Psychology: it.chapter2Psychology
          ? String(it.chapter2Psychology).trim()
          : "",
        threeGunas: it.threeGunas ? String(it.threeGunas).trim() : "",
        dashavatara: it.dashavatara ? String(it.dashavatara).trim() : "",
        treasure: it.treasure ? String(it.treasure).trim() : "",
        focusAreas: it.focusAreas ? String(it.focusAreas).trim() : "",
        isActive: it.isActive !== undefined ? it.isActive : true,
        createdAt: now,
        updatedAt: now,
      });
    }

    db.collection("sm-practice-lab-situation")
      .insertMany(docs)
      .then((r) =>
        resolve({
          status: 200,
          message: "Situations imported",
          data: [{ inserted: r.insertedCount }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to import situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllSmPracticeLabSituations = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.situation = { $regex: safe, $options: "i" };
    }
    if (filters && filters.power) query.power = filters.power;
    if (filters && filters.category) query.category = filters.category;
    if (filters && filters.level) query.level = filters.level;
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = Number(filters && filters.page) > 0 ? Number(filters.page) : 1;
    const limit =
      Number(filters && filters.limit) > 0 ? Number(filters.limit) : 10;
    const skip = (page - 1) * limit;

    const col = db.collection("sm-practice-lab-situation");

    col
      .countDocuments(query)
      .then((total) => {
        return col
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray()
          .then((items) =>
            resolve({
              status: 200,
              message: "Situations fetched",
              data: items,
              pagination: {
                total: total,
                page: page,
                limit: limit,
                totalPages: Math.ceil(total / limit) || 1,
              },
            }),
          );
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getSmPracticeLabSituationById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-situation")
      .findOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Situation fetched", data: [r] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateSmPracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.situation !== undefined) updates.situation = data.situation;
    if (data.power !== undefined) updates.power = data.power;
    if (data.category !== undefined) updates.category = data.category;
    if (data.level !== undefined) updates.level = data.level;
    if (data.ageGroup !== undefined) updates.ageGroup = data.ageGroup;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = Number(data.smKeyReward);
    if (data.blaze !== undefined) updates.blaze = data.blaze;
    if (data.shello !== undefined) updates.shello = data.shello;
    if (data.champ !== undefined) updates.champ = data.champ;
    if (data.tejix !== undefined) updates.tejix = data.tejix;
    if (data.tejixInsight !== undefined)
      updates.tejixInsight = data.tejixInsight;
    if (data.hiddenTopic !== undefined) updates.hiddenTopic = data.hiddenTopic;
    if (data.lifeSkill !== undefined) updates.lifeSkill = data.lifeSkill;
    if (data.primaryEmotion !== undefined)
      updates.primaryEmotion = data.primaryEmotion;
    if (data.indriya !== undefined) updates.indriya = data.indriya;
    if (data.gitaChapters !== undefined)
      updates.gitaChapters = data.gitaChapters;
    if (data.chapter2Psychology !== undefined)
      updates.chapter2Psychology = data.chapter2Psychology;
    if (data.threeGunas !== undefined) updates.threeGunas = data.threeGunas;
    if (data.dashavatara !== undefined) updates.dashavatara = data.dashavatara;
    if (data.treasure !== undefined) updates.treasure = data.treasure;
    if (data.focusAreas !== undefined) updates.focusAreas = data.focusAreas;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("sm-practice-lab-situation")
      .updateOne({ _id: new ObjectId(data.situationId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Situation updated", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteSmPracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-situation")
      .deleteOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Situation deleted", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

// ============================================================
// APP SIDE - one random active situation for the Practice Lab
// ============================================================
const getSmPracticeLabSituationForApp = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("sm-practice-lab-situation")
      .aggregate([{ $match: { isActive: true } }, { $sample: { size: 1 } }])
      .toArray()
      .then((items) =>
        resolve({
          status: 200,
          message: "Situation fetched",
          data: items,
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const bulkAddPracticeLabSituations = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const rows = Array.isArray(data.items) ? data.items : [];
    if (rows.length === 0) {
      return reject({ status: 400, message: "No rows to import", data: [] });
    }
    const docs = rows
      .filter((r) => r.situation && r.situation.trim())
      .map((r) => ({
        situation: r.situation.trim(),
        category: r.category ? r.category.trim() : "",
        difficulty: r.difficulty || "Easy",
        smKeyReward: parseInt(r.smKeyReward) || 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    if (docs.length === 0) {
      return reject({
        status: 400,
        message: "No valid rows to import",
        data: [],
      });
    }
    db.collection("practice-lab-situation")
      .insertMany(docs)
      .then((r) =>
        resolve({
          status: 200,
          message: `${r.insertedCount} situations imported`,
          data: [],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to import situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const bulkAddGrowthFocusSituations = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const rows = Array.isArray(data.items) ? data.items : [];
    if (rows.length === 0) {
      return reject({ status: 400, message: "No rows to import", data: [] });
    }
    const docs = rows
      .filter((r) => r.title && r.title.trim())
      .map((r) => ({
        title: r.title.trim(),
        category: r.category ? r.category.trim() : "",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    if (docs.length === 0) {
      return reject({
        status: 400,
        message: "No valid rows to import",
        data: [],
      });
    }
    db.collection("growth-focus-situation")
      .insertMany(docs)
      .then((r) =>
        resolve({
          status: 200,
          message: `${r.insertedCount} situations imported`,
          data: [],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to import situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGratitudePause = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }
    const doc = {
      title: data.title.trim(),
      icon: data.icon || "",
      displayOrder: parseInt(data.displayOrder) || 0,
      smKeyReward: parseInt(data.smKeyReward) || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("gratitude-pause")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Gratitude pause created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create gratitude pause",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllGratitudePause = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 7;
    const skip = (page - 1) * limit;

    Promise.all([
      db
        .collection("gratitude-pause")
        .find(query)
        .sort({ displayOrder: 1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("gratitude-pause").countDocuments(query),
    ])
      .then(([items, total]) =>
        resolve({
          status: 200,
          message: "Gratitude pause fetched",
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch gratitude pause",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGratitudePauseById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("gratitude-pause")
      .findOne({ _id: new ObjectId(data.gratitudeId) })
      .then((r) =>
        r
          ? resolve({
              status: 200,
              message: "Gratitude pause fetched",
              data: [r],
            })
          : reject({
              status: 404,
              message: "Gratitude pause not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch gratitude pause",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateGratitudePause = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.displayOrder !== undefined)
      updates.displayOrder = parseInt(data.displayOrder) || 0;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 1;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("gratitude-pause")
      .updateOne({ _id: new ObjectId(data.gratitudeId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({
              status: 200,
              message: "Gratitude pause updated",
              data: [],
            })
          : reject({
              status: 404,
              message: "Gratitude pause not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update gratitude pause",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteGratitudePause = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("gratitude-pause")
      .deleteOne({ _id: new ObjectId(data.gratitudeId) })
      .then((r) =>
        r.deletedCount
          ? resolve({
              status: 200,
              message: "Gratitude pause deleted",
              data: [],
            })
          : reject({
              status: 404,
              message: "Gratitude pause not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete gratitude pause",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateHelpfulActionCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection(HAC)
      .updateOne({ _id: new ObjectId(data.categoryId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Category updated", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteHelpfulActionCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(HAC)
      .deleteOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Category deleted", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateResponsibilityCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection(RC)
      .updateOne({ _id: new ObjectId(data.categoryId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Category updated", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteResponsibilityCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(RC)
      .deleteOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Category deleted", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGalleryImage = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.url) {
      return reject({ status: 400, message: "url is required", data: [] });
    }
    const doc = {
      url: data.url,
      folder: data.folder || "sustainable-mind",
      createdAt: new Date(),
    };
    db.collection("gallery")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Image saved",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to save image",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGalleryImages = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.folder) query.folder = filters.folder;

    const page = parseInt(filters && filters.page) || 1;
    const limit = parseInt(filters && filters.limit) || 60;
    const skip = (page - 1) * limit;

    db.collection("gallery")
      .find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Gallery fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch gallery",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addPracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.situation || !data.situation.trim()) {
      return reject({
        status: 400,
        message: "Situation is required",
        data: [],
      });
    }
    const doc = {
      situation: data.situation.trim(),
      category: data.category || "",
      difficulty: data.difficulty || "Easy",
      smKeyReward: parseInt(data.smKeyReward) || 5,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("practice-lab-situation")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Situation created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllPracticeLabSituations = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.situation = { $regex: safe, $options: "i" };
    }
    if (filters.category && filters.category !== "all")
      query.category = filters.category;
    if (filters.difficulty) query.difficulty = filters.difficulty;
    if (filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;

    Promise.all([
      db
        .collection("practice-lab-situation")
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("practice-lab-situation").countDocuments(query),
    ])
      .then(([items, total]) =>
        resolve({
          status: 200,
          message: "Situations fetched",
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getPracticeLabSituationById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("practice-lab-situation")
      .findOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Situation fetched", data: [r] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updatePracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.situation !== undefined) updates.situation = data.situation;
    if (data.category !== undefined) updates.category = data.category;
    if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 5;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("practice-lab-situation")
      .updateOne({ _id: new ObjectId(data.situationId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Situation updated", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deletePracticeLabSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("practice-lab-situation")
      .deleteOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Situation deleted", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addPracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim()) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }
    const doc = {
      name: data.name.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("practice-lab-category")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllPracticeLabCategories = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("practice-lab-category")
      .find(query)
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Categories fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getPracticeLabCategoryById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("practice-lab-category")
      .findOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Category fetched", data: [r] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updatePracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("practice-lab-category")
      .updateOne({ _id: new ObjectId(data.categoryId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Category updated", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deletePracticeLabCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("practice-lab-category")
      .deleteOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Category deleted", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGrowthFocusSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }
    const doc = {
      title: data.title.trim(),
      category: data.category || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("growth-focus-situation")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Situation created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllGrowthFocusSituations = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters.category && filters.category !== "all")
      query.category = filters.category;
    if (filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;

    Promise.all([
      db
        .collection("growth-focus-situation")
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("growth-focus-situation").countDocuments(query),
    ])
      .then(([items, total]) =>
        resolve({
          status: 200,
          message: "Situations fetched",
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch situations",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGrowthFocusSituationById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus-situation")
      .findOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Situation fetched", data: [r] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateGrowthFocusSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.category !== undefined) updates.category = data.category;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("growth-focus-situation")
      .updateOne({ _id: new ObjectId(data.situationId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Situation updated", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteGrowthFocusSituation = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus-situation")
      .deleteOne({ _id: new ObjectId(data.situationId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Situation deleted", data: [] })
          : reject({ status: 404, message: "Situation not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete situation",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGrowthFocusCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim()) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }
    const doc = {
      name: data.name.trim(),
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("growth-focus-category")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllGrowthFocusCategories = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("growth-focus-category")
      .find(query)
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Categories fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGrowthFocusCategoryById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus-category")
      .findOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Category fetched", data: [r] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateGrowthFocusCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("growth-focus-category")
      .updateOne({ _id: new ObjectId(data.categoryId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Category updated", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteGrowthFocusCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus-category")
      .deleteOne({ _id: new ObjectId(data.categoryId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Category deleted", data: [] })
          : reject({ status: 404, message: "Category not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGrowthFocus = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }
    const doc = {
      title: data.title.trim(),
      description: data.description || "",
      icon: data.icon || "",
      smKeyReward: parseInt(data.smKeyReward) || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("growth-focus")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Growth focus created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create growth focus",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllGrowthFocus = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("growth-focus")
      .find(query)
      .sort({ _id: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Growth focus fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch growth focus",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGrowthFocusById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus")
      .findOne({ _id: new ObjectId(data.growthFocusId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Growth focus fetched", data: [r] })
          : reject({
              status: 404,
              message: "Growth focus not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch growth focus",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateGrowthFocus = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 1;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("growth-focus")
      .updateOne({ _id: new ObjectId(data.growthFocusId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Growth focus updated", data: [] })
          : reject({
              status: 404,
              message: "Growth focus not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update growth focus",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteGrowthFocus = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("growth-focus")
      .deleteOne({ _id: new ObjectId(data.growthFocusId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Growth focus deleted", data: [] })
          : reject({
              status: 404,
              message: "Growth focus not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete growth focus",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addGreeting = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }
    const doc = {
      title: data.title.trim(),
      icon: data.icon || "",
      smKeyReward: parseInt(data.smKeyReward) || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("greeting-challenge")
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Greeting created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create greeting",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllGreetings = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters && filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    db.collection("greeting-challenge")
      .find(query)
      .sort({ _id: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Greetings fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch greetings",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getGreetingById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("greeting-challenge")
      .findOne({ _id: new ObjectId(data.greetingId) })
      .then((r) =>
        r
          ? resolve({ status: 200, message: "Greeting fetched", data: [r] })
          : reject({ status: 404, message: "Greeting not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch greeting",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateGreeting = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 1;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection("greeting-challenge")
      .updateOne({ _id: new ObjectId(data.greetingId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({ status: 200, message: "Greeting updated", data: [] })
          : reject({ status: 404, message: "Greeting not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update greeting",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteGreeting = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("greeting-challenge")
      .deleteOne({ _id: new ObjectId(data.greetingId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Greeting deleted", data: [] })
          : reject({ status: 404, message: "Greeting not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete greeting",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getPendingSuggestions = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters && filters.status === "active") query.isActive = { $ne: false };
    db.collection("pending-suggestions")
      .find(query)
      .sort({ _id: -1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Suggestions fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch suggestions",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deletePendingSuggestion = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("pending-suggestions")
      .deleteOne({ _id: new ObjectId(data.suggestionId) })
      .then((r) =>
        r.deletedCount
          ? resolve({ status: 200, message: "Suggestion deleted", data: [] })
          : reject({ status: 404, message: "Suggestion not found", data: [] }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete suggestion",
          data: [],
          error: e.message,
        }),
      );
  });
};
const acceptPendingSuggestion = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    try {
      const s = await db
        .collection("pending-suggestions")
        .findOne({ _id: new ObjectId(data.suggestionId) });
      if (!s) {
        return reject({
          status: 404,
          message: "Suggestion not found",
          data: [],
        });
      }

      await db.collection("helpful-actions").insertOne({
        action: s.suggestedAction || s.action || "",
        category: s.category || "",
        icon: s.icon || "",
        smKeyReward: 1,
        isActive: true,
        fromSuggestion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db
        .collection("pending-suggestions")
        .deleteOne({ _id: new ObjectId(data.suggestionId) });

      resolve({
        status: 200,
        message: "Suggestion accepted and added to helpful actions",
        data: [],
      });
    } catch (e) {
      reject({
        status: 400,
        message: "Unable to accept suggestion",
        data: [],
        error: e.message,
      });
    }
  });
};

const addHelpfulAction = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.action || !data.action.trim()) {
      return reject({ status: 400, message: "Action is required", data: [] });
    }
    const doc = {
      action: data.action.trim(),
      category: data.category || "",
      icon: data.icon || "",
      smKeyReward: parseInt(data.smKeyReward) || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection(HA)
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Helpful action created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create helpful action",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllHelpfulActions = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.action = { $regex: safe, $options: "i" };
    }
    if (filters.category) query.category = filters.category;
    if (filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 7;
    const skip = (page - 1) * limit;

    Promise.all([
      db
        .collection(HA)
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(HA).countDocuments(query),
    ])
      .then(([items, total]) =>
        resolve({
          status: 200,
          message: "Helpful actions fetched",
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch helpful actions",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getHelpfulActionById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(HA)
      .findOne({ _id: new ObjectId(data.actionId) })
      .then((r) =>
        r
          ? resolve({
              status: 200,
              message: "Helpful action fetched",
              data: [r],
            })
          : reject({
              status: 404,
              message: "Helpful action not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch helpful action",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateHelpfulAction = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.action !== undefined) updates.action = data.action;
    if (data.category !== undefined) updates.category = data.category;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 1;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection(HA)
      .updateOne({ _id: new ObjectId(data.actionId) }, { $set: updates })
      .then((r) =>
        r.matchedCount
          ? resolve({
              status: 200,
              message: "Helpful action updated",
              data: [],
            })
          : reject({
              status: 404,
              message: "Helpful action not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update helpful action",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteHelpfulAction = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(HA)
      .deleteOne({ _id: new ObjectId(data.actionId) })
      .then((r) =>
        r.deletedCount
          ? resolve({
              status: 200,
              message: "Helpful action deleted",
              data: [],
            })
          : reject({
              status: 404,
              message: "Helpful action not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete helpful action",
          data: [],
          error: e.message,
        }),
      );
  });
};

/* categories for the dropdown (collection: helpful-action-categories) */
const getHelpfulActionCategories = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(HAC)
      .find({})
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Categories fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addHelpfulActionCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim())
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    const doc = {
      name: data.name.trim(),
      isActive: true,
      createdAt: new Date(),
    };
    db.collection(HAC)
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addResponsibility = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.title.trim()) {
      return reject({ status: 400, message: "Title is required", data: [] });
    }
    const doc = {
      title: data.title.trim(),
      category: data.category || "",
      icon: data.icon || "",
      smKeyReward: parseInt(data.smKeyReward) || 1,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection(RM)
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Responsibility created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create responsibility",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getAllResponsibilities = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.title = { $regex: safe, $options: "i" };
    }
    if (filters.category) query.category = filters.category;
    if (filters.status)
      query.isActive = filters.status.toLowerCase() === "active";

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 7;
    const skip = (page - 1) * limit;

    Promise.all([
      db
        .collection(RM)
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection(RM).countDocuments(query),
    ])
      .then(([items, total]) =>
        resolve({
          status: 200,
          message: "Responsibilities fetched",
          data: items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch responsibilities",
          data: [],
          error: e.message,
        }),
      );
  });
};

const getResponsibilityById = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(RM)
      .findOne({ _id: new ObjectId(data.responsibilityId) })
      .then((r) =>
        r
          ? resolve({
              status: 200,
              message: "Responsibility fetched",
              data: [r],
            })
          : reject({
              status: 404,
              message: "Responsibility not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to fetch responsibility",
          data: [],
          error: e.message,
        }),
      );
  });
};

const updateResponsibility = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.category !== undefined) updates.category = data.category;
    if (data.icon !== undefined) updates.icon = data.icon;
    if (data.smKeyReward !== undefined)
      updates.smKeyReward = parseInt(data.smKeyReward) || 1;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    db.collection(RM)
      .updateOne(
        { _id: new ObjectId(data.responsibilityId) },
        { $set: updates },
      )
      .then((r) =>
        r.matchedCount
          ? resolve({
              status: 200,
              message: "Responsibility updated",
              data: [],
            })
          : reject({
              status: 404,
              message: "Responsibility not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to update responsibility",
          data: [],
          error: e.message,
        }),
      );
  });
};

const deleteResponsibility = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(RM)
      .deleteOne({ _id: new ObjectId(data.responsibilityId) })
      .then((r) =>
        r.deletedCount
          ? resolve({
              status: 200,
              message: "Responsibility deleted",
              data: [],
            })
          : reject({
              status: 404,
              message: "Responsibility not found",
              data: [],
            }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to delete responsibility",
          data: [],
          error: e.message,
        }),
      );
  });
};

/* categories for the dropdown (collection: responsibility_categories) */
const getResponsibilityCategories = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection(RC)
      .find({})
      .sort({ name: 1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Categories fetched", data: items }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: e.message,
        }),
      );
  });
};

const addResponsibilityCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.name || !data.name.trim())
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    const doc = {
      name: data.name.trim(),
      isActive: true,
      createdAt: new Date(),
    };
    db.collection(RC)
      .insertOne(doc)
      .then((r) =>
        resolve({
          status: 200,
          message: "Category created",
          data: [{ _id: r.insertedId, ...doc }],
        }),
      )
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to create category",
          data: [],
          error: e.message,
        }),
      );
  });
};

const generatePresignedUrl = async (data) => {
  return new Promise((resolve, reject) => {
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.awsAccessKeyId,
        secretAccessKey: process.env.awsAccessKey,
      },
      region: "ap-south-1",
    });

    const command = new PutObjectCommand({
      Bucket: "happy-tokens",
      Key: `sustainable-mind/${data.fileName}`,
      ContentType: `${data.contentType}`,
    });
    getSignedUrl(s3Client, command, { expiresIn: 3600 })
      .then((result) => {
        resolve({
          status: 200,
          message: "generated signed url",
          data: [{ result }],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: `Unable to generate signed url ${error}`,
          data: [],
        });
      });
  });
};

const adminLogin = (data) => {
  const id = data.id;
  const password = data.password;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("admins")
      .findOne({ id: id, password: password })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Invalid admin ID or password",
            data: [],
          });
        }
        const { password: _, ...safeAdmin } = result;
        resolve({
          status: 200,
          message: "Admin logged in",
          data: [safeAdmin],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to login admin",
          data: [],
          error: error.message,
        });
      });
  });
};

const changeAdminPassword = (data) => {
  const { adminId, oldPassword, newPassword } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("admins")
      .findOne({ _id: new ObjectId(adminId), password: oldPassword })
      .then((admin) => {
        if (!admin) {
          return reject({
            status: 404,
            message: "Old password is incorrect",
            data: [],
          });
        }
        return db
          .collection("admins")
          .updateOne(
            { _id: new ObjectId(adminId) },
            { $set: { password: newPassword, updatedAt: new Date() } },
          );
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Password updated successfully",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to change password",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateAdminProfile = (data) => {
  const { adminId, name, email, phone } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;

    db.collection("admins")
      .updateOne({ _id: new ObjectId(adminId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Admin not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Profile updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update profile",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   STORIES
   ============================================================ */

const addStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const story = {
      title: data.title,
      author: data.author,
      coverImage: data.coverImage || "",
      coverImageUrl: data.coverImageUrl || "",
      audioUrl: data.audioUrl || "",
      categoryId: data.categoryId ? new ObjectId(data.categoryId) : null,
      categoryName: data.categoryName || "",
      subcategoryId: data.subcategoryId || null,
      subcategoryName: data.subcategoryName || "",
      summary: data.summary || "",
      content: data.content,
      status: data.status || "draft",
      views: 0,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (!story.title || !story.content) {
      return reject({
        status: 400,
        message: "Title and content are required",
        data: [],
      });
    }

    db.collection("stories")
      .insertOne(story)
      .then((result) => {
        resolve({
          status: 200,
          message: "Story created",
          data: [{ _id: result.insertedId, ...story }],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to create story",
          data: [],
          error: error.message,
        });
      });
  });
};

const getAllStories = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};

    if (filters.status) {
      query.status = filters.status.toLowerCase();
    }
    if (filters.categoryId) {
      query.categoryId = new ObjectId(filters.categoryId);
    }
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { author: { $regex: safe, $options: "i" } },
        { categoryName: { $regex: safe, $options: "i" } },
      ];
    }
    if (filters.lastId) {
      query._id = { $lt: new ObjectId(filters.lastId) };
    }

    const limit = parseInt(filters.limit) || 20;
    const sortField =
      filters.sort === "views" ? { views: -1, _id: -1 } : { _id: -1 };

    db.collection("stories")
      .find(query)
      .sort(sortField)
      .limit(limit)
      .toArray()
      .then((stories) => {
        const hasMore = stories.length === limit;
        const lastId =
          stories.length > 0
            ? stories[stories.length - 1]._id.toString()
            : null;
        resolve({
          status: 200,
          message: "Stories fetched",
          data: stories,
          pagination: { hasMore, lastId, limit },
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Could not fetch stories",
          data: [],
          error: error.message,
        });
      });
  });
};

const getStoryById = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .findOne({ _id: new ObjectId(storyId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story fetched",
          data: [result],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch story",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateStory = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.title) updates.title = data.title;
    if (data.author) updates.author = data.author;
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
    if (data.coverImageUrl !== undefined)
      updates.coverImageUrl = data.coverImageUrl;
    if (data.audioUrl !== undefined) updates.audioUrl = data.audioUrl;
    if (data.categoryId) {
      updates.categoryId = new ObjectId(data.categoryId);
      updates.categoryName = data.categoryName || "";
    }
    if (data.subcategoryId !== undefined)
      updates.subcategoryId = data.subcategoryId;
    if (data.subcategoryName !== undefined)
      updates.subcategoryName = data.subcategoryName;
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.content) updates.content = data.content;
    if (data.status) updates.status = data.status;

    db.collection("stories")
      .updateOne({ _id: new ObjectId(storyId) }, { $set: updates })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story updated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update story",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteStory = (data) => {
  const storyId = data.storyId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .deleteOne({ _id: new ObjectId(storyId) })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Story deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete story",
          data: [],
          error: error.message,
        });
      });
  });
};

const changeStoryStatus = (data) => {
  const { storyId, status } = data;
  return new Promise((resolve, reject) => {
    const validStatuses = ["draft", "published", "archived"];
    if (!validStatuses.includes(status)) {
      return reject({
        status: 400,
        message: "Invalid status",
        data: [],
      });
    }
    const db = getDb();
    db.collection("stories")
      .updateOne(
        { _id: new ObjectId(storyId) },
        { $set: { status: status, updatedAt: new Date() } },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: `Story marked as ${status}`,
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to change status",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   CATEGORIES (subcategories stored as embedded array)
   ============================================================ */

// Create a top-level category
const addCategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();

    if (!data.name || data.name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Category name is required",
        data: [],
      });
    }

    try {
      const count = await db.collection("categories").countDocuments({});

      const category = {
        name: data.name.trim(),
        imageUrl: data.imageUrl || "",
        description: data.description || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: count,
        subcategories: [], // embedded array
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("categories").insertOne(category);
      resolve({
        status: 200,
        message: "Category created",
        data: [{ ...category, _id: result.insertedId }],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not create category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Update category fields (name, image, description, active)
const updateCategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId || data._id;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    const updateFields = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name.trim();
    if (data.imageUrl !== undefined) updateFields.imageUrl = data.imageUrl;
    if (data.description !== undefined) {
      updateFields.description = data.description;
    }
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;

    db.collection("categories")
      .updateOne({ _id: new ObjectId(categoryId) }, { $set: updateFields })
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Category updated",
          data: [],
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not update category",
          data: [],
          error: err.message,
        });
      });
  });
};

// Delete a whole category
const deleteCategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId || data._id;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    try {
      const result = await db.collection("categories").deleteOne({
        _id: new ObjectId(categoryId),
      });
      if (result.deletedCount === 0) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }
      resolve({
        status: 200,
        message: "Category deleted",
        data: [],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not delete category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Get one category with its subcategories + story count
const getCategoryDetails = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const categoryId = data.categoryId;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });

      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const storyCount = await db.collection("stories").countDocuments({
        categoryId: new ObjectId(categoryId),
        status: "published",
      });

      // Sort embedded subcategories by order
      const subs = (category.subcategories || []).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      resolve({
        status: 200,
        message: "Category fetched",
        data: [{ ...category, subcategories: subs, storyCount }],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not fetch category",
        data: [],
        error: err.message,
      });
    }
  });
};

// Get all top-level categories
const getAllCategories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    db.collection("categories")
      .find({})
      .sort({ order: 1, name: 1 })
      .toArray()
      .then(async (categories) => {
        const enriched = await Promise.all(
          categories.map(async (cat) => {
            const storyCount = await db.collection("stories").countDocuments({
              categoryId: cat._id,
              status: "published",
            });
            return {
              ...cat,
              storyCount,
              subcategoryCount: (cat.subcategories || []).length,
            };
          }),
        );

        resolve({
          status: 200,
          message: "Categories fetched",
          data: enriched,
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not fetch categories",
          data: [],
          error: err.message,
        });
      });
  });
};

const getCategoryById = (data) => {
  const categoryId = data.categoryId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .findOne({ _id: new ObjectId(categoryId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Category fetched",
          data: [result],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch category",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ----------- SUBCATEGORIES (operate on embedded array) ----------- */

// Add a subcategory to a category's array
const addSubcategory = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const { categoryId, name } = data;

    if (!categoryId || !ObjectId.isValid(categoryId)) {
      return reject({
        status: 400,
        message: "Valid category ID is required",
        data: [],
      });
    }
    if (!name || name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Subcategory name is required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });
      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const subcategory = {
        _id: new ObjectId(),
        name: name.trim(),
        order: (category.subcategories || []).length,
      };

      await db.collection("categories").updateOne(
        { _id: new ObjectId(categoryId) },
        {
          $push: { subcategories: subcategory },
          $set: { updatedAt: new Date() },
        },
      );

      resolve({
        status: 200,
        message: "Subcategory added",
        data: [subcategory],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not add subcategory",
        data: [],
        error: err.message,
      });
    }
  });
};

// Update a subcategory's name (positional $)
const updateSubcategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { categoryId, subcategoryId, name } = data;

    if (!ObjectId.isValid(categoryId) || !ObjectId.isValid(subcategoryId)) {
      return reject({
        status: 400,
        message: "Valid category and subcategory IDs are required",
        data: [],
      });
    }
    if (!name || name.trim().length === 0) {
      return reject({
        status: 400,
        message: "Subcategory name is required",
        data: [],
      });
    }

    db.collection("categories")
      .updateOne(
        {
          _id: new ObjectId(categoryId),
          "subcategories._id": new ObjectId(subcategoryId),
        },
        {
          $set: {
            "subcategories.$.name": name.trim(),
            updatedAt: new Date(),
          },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Subcategory not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Subcategory updated",
          data: [],
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not update subcategory",
          data: [],
          error: err.message,
        });
      });
  });
};

// Delete a subcategory from the array ($pull)
const deleteSubcategory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { categoryId, subcategoryId } = data;

    if (!ObjectId.isValid(categoryId) || !ObjectId.isValid(subcategoryId)) {
      return reject({
        status: 400,
        message: "Valid category and subcategory IDs are required",
        data: [],
      });
    }

    db.collection("categories")
      .updateOne(
        { _id: new ObjectId(categoryId) },
        {
          $pull: { subcategories: { _id: new ObjectId(subcategoryId) } },
          $set: { updatedAt: new Date() },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Category not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Subcategory deleted",
          data: [],
        });
      })
      .catch((err) => {
        reject({
          status: 400,
          message: "Could not delete subcategory",
          data: [],
          error: err.message,
        });
      });
  });
};

// Reorder subcategories - replace array in the new order
const reorderSubcategories = (data) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();
    const { categoryId, orderedIds } = data;

    if (!ObjectId.isValid(categoryId) || !Array.isArray(orderedIds)) {
      return reject({
        status: 400,
        message: "Valid categoryId and orderedIds array are required",
        data: [],
      });
    }

    try {
      const category = await db.collection("categories").findOne({
        _id: new ObjectId(categoryId),
      });
      if (!category) {
        return reject({
          status: 404,
          message: "Category not found",
          data: [],
        });
      }

      const subs = category.subcategories || [];
      const reordered = orderedIds
        .map((id, index) => {
          const sub = subs.find((s) => s._id.toString() === id.toString());
          if (!sub) return null;
          return { ...sub, order: index };
        })
        .filter(Boolean);

      await db
        .collection("categories")
        .updateOne(
          { _id: new ObjectId(categoryId) },
          { $set: { subcategories: reordered, updatedAt: new Date() } },
        );

      resolve({
        status: 200,
        message: "Order updated",
        data: [],
      });
    } catch (err) {
      reject({
        status: 400,
        message: "Could not reorder subcategories",
        data: [],
        error: err.message,
      });
    }
  });
};

/* ============================================================
   USERS
   ============================================================ */

const getAllUsers = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = {};

    if (filters.status) {
      const s = filters.status.toLowerCase();
      if (s === "active") {
        query.status = "Active";
      } else if (s === "suspended") {
        query.status = "Suspended";
      } else if (s === "premium") {
        query.isPremium = true;
      }
    }

    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { mobile: { $regex: safe, $options: "i" } },
      ];
    }

    if (filters.lastId) {
      query._id = { $lt: new ObjectId(filters.lastId) };
    }

    const limit = parseInt(filters.limit) || 20;

    db.collection("users")
      .find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .toArray()
      .then((users) => {
        const hasMore = users.length === limit;
        const lastId =
          users.length > 0 ? users[users.length - 1]._id.toString() : null;
        resolve({
          status: 200,
          message: "Users fetched",
          data: users,
          pagination: { hasMore, lastId, limit },
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Could not fetch users",
          data: [],
          error: error.message,
        });
      });
  });
};

const getUserById = (data) => {
  const userId = data.userId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((result) => {
        if (!result) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "User fetched",
          data: [result],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch user",
          data: [],
          error: error.message,
        });
      });
  });
};

const suspendUser = (data) => {
  const { userId, suspend } = data;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: suspend ? "Suspended" : "Active",
            updatedAt: new Date(),
          },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: suspend ? "User suspended" : "User reactivated",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to update user status",
          data: [],
          error: error.message,
        });
      });
  });
};

const deleteUser = (data) => {
  const userId = data.userId;
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .deleteOne({ _id: new ObjectId(userId) })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "User deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete user",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   DASHBOARD / ANALYTICS
   ============================================================ */

const getDashboardOverview = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    Promise.all([
      db.collection("stories").countDocuments({}),
      db.collection("stories").countDocuments({ status: "published" }),
      db.collection("users").countDocuments({}),
      db.collection("users").countDocuments({ status: "Active" }),
      db.collection("users").countDocuments({ isPremium: true }),
      db.collection("categories").countDocuments({}),
      db.collection("stories").countDocuments({
        createdAt: { $gte: sevenDaysAgo },
      }),
    ])
      .then(
        ([
          totalStories,
          publishedStories,
          totalUsers,
          activeUsers,
          premiumUsers,
          totalCategories,
          storiesLast7Days,
        ]) => {
          resolve({
            status: 200,
            message: "Dashboard overview fetched",
            data: [
              {
                totalStories,
                publishedStories,
                totalUsers,
                activeUsers,
                premiumUsers,
                totalCategories,
                storiesLast7Days,
              },
            ],
          });
        },
      )
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch dashboard overview",
          data: [],
          error: error.message,
        });
      });
  });
};

const getRecentStories = (data) => {
  return new Promise((resolve, reject) => {
    const limit = (data && data.limit) || 5;
    const db = getDb();
    db.collection("stories")
      .find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Recent stories fetched",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch recent stories",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   EXPORTS
   ============================================================ */

const wrap = (fn) => (data) =>
  new Promise((resolve, reject) => {
    return fn(data)
      .then((result) => {
        if (result && result.status == 200) {
          resolve(result);
        } else {
          reject(result);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });

module.exports = {
  // Auth
  adminLogin: wrap(adminLogin),
  changeAdminPassword: wrap(changeAdminPassword),
  updateAdminProfile: wrap(updateAdminProfile),
  generatePresignedUrl: wrap(generatePresignedUrl),

  // Stories
  addStory: wrap(addStory),
  getAllStories: wrap(getAllStories),
  getStoryById: wrap(getStoryById),
  updateStory: wrap(updateStory),
  deleteStory: wrap(deleteStory),
  changeStoryStatus: wrap(changeStoryStatus),

  // Categories
  addCategory: wrap(addCategory),
  getAllCategories: wrap(getAllCategories),
  getCategoryById: wrap(getCategoryById),
  getCategoryDetails: wrap(getCategoryDetails),
  updateCategory: wrap(updateCategory),
  deleteCategory: wrap(deleteCategory),

  // Subcategories
  addSubcategory: wrap(addSubcategory),
  updateSubcategory: wrap(updateSubcategory),
  deleteSubcategory: wrap(deleteSubcategory),
  reorderSubcategories: wrap(reorderSubcategories),

  // Users
  getAllUsers: wrap(getAllUsers),
  getUserById: wrap(getUserById),
  suspendUser: wrap(suspendUser),
  deleteUser: wrap(deleteUser),

  // Dashboard
  getDashboardOverview: wrap(getDashboardOverview),
  getRecentStories: wrap(getRecentStories),

  addResponsibility: wrap(addResponsibility),
  getAllResponsibilities: wrap(getAllResponsibilities),
  getResponsibilityById: wrap(getResponsibilityById),
  updateResponsibility: wrap(updateResponsibility),
  deleteResponsibility: wrap(deleteResponsibility),
  getResponsibilityCategories: wrap(getResponsibilityCategories),
  addResponsibilityCategory: wrap(addResponsibilityCategory),

  addHelpfulAction: wrap(addHelpfulAction),
  getAllHelpfulActions: wrap(getAllHelpfulActions),
  getHelpfulActionById: wrap(getHelpfulActionById),
  updateHelpfulAction: wrap(updateHelpfulAction),
  deleteHelpfulAction: wrap(deleteHelpfulAction),
  getHelpfulActionCategories: wrap(getHelpfulActionCategories),
  addHelpfulActionCategory: wrap(addHelpfulActionCategory),

  getPendingSuggestions: wrap(getPendingSuggestions),
  deletePendingSuggestion: wrap(deletePendingSuggestion),
  acceptPendingSuggestion: wrap(acceptPendingSuggestion),

  addGreeting: wrap(addGreeting),
  getAllGreetings: wrap(getAllGreetings),
  getGreetingById: wrap(getGreetingById),
  updateGreeting: wrap(updateGreeting),
  deleteGreeting: wrap(deleteGreeting),

  addGrowthFocus: wrap(addGrowthFocus),
  getAllGrowthFocus: wrap(getAllGrowthFocus),
  getGrowthFocusById: wrap(getGrowthFocusById),
  updateGrowthFocus: wrap(updateGrowthFocus),
  deleteGrowthFocus: wrap(deleteGrowthFocus),

  addGrowthFocusCategory: wrap(addGrowthFocusCategory),
  getAllGrowthFocusCategories: wrap(getAllGrowthFocusCategories),
  getGrowthFocusCategoryById: wrap(getGrowthFocusCategoryById),
  updateGrowthFocusCategory: wrap(updateGrowthFocusCategory),
  deleteGrowthFocusCategory: wrap(deleteGrowthFocusCategory),

  addGrowthFocusSituation: wrap(addGrowthFocusSituation),
  getAllGrowthFocusSituations: wrap(getAllGrowthFocusSituations),
  getGrowthFocusSituationById: wrap(getGrowthFocusSituationById),
  updateGrowthFocusSituation: wrap(updateGrowthFocusSituation),
  deleteGrowthFocusSituation: wrap(deleteGrowthFocusSituation),

  addPracticeLabCategory: wrap(addPracticeLabCategory),
  getAllPracticeLabCategories: wrap(getAllPracticeLabCategories),
  getPracticeLabCategoryById: wrap(getPracticeLabCategoryById),
  updatePracticeLabCategory: wrap(updatePracticeLabCategory),
  deletePracticeLabCategory: wrap(deletePracticeLabCategory),

  addPracticeLabSituation: wrap(addPracticeLabSituation),
  getAllPracticeLabSituations: wrap(getAllPracticeLabSituations),
  getPracticeLabSituationById: wrap(getPracticeLabSituationById),
  updatePracticeLabSituation: wrap(updatePracticeLabSituation),
  deletePracticeLabSituation: wrap(deletePracticeLabSituation),
  addGalleryImage: wrap(addGalleryImage),
  getGalleryImages: wrap(getGalleryImages),

  updateResponsibilityCategory: wrap(updateResponsibilityCategory),
  deleteResponsibilityCategory: wrap(deleteResponsibilityCategory),

  getHelpfulActionCategories: wrap(getHelpfulActionCategories),
  addHelpfulActionCategory: wrap(addHelpfulActionCategory),
  updateHelpfulActionCategory: wrap(updateHelpfulActionCategory),
  deleteHelpfulActionCategory: wrap(deleteHelpfulActionCategory),

  addGratitudePause: wrap(addGratitudePause),
  getAllGratitudePause: wrap(getAllGratitudePause),
  getGratitudePauseById: wrap(getGratitudePauseById),
  updateGratitudePause: wrap(updateGratitudePause),
  deleteGratitudePause: wrap(deleteGratitudePause),

  bulkAddGrowthFocusSituations: wrap(bulkAddGrowthFocusSituations),
  bulkAddPracticeLabSituations: wrap(bulkAddPracticeLabSituations),

  // ---------- SM Practice Lab - Categories ----------
  addSmPracticeLabCategory: wrap(addSmPracticeLabCategory),
  getAllSmPracticeLabCategories: wrap(getAllSmPracticeLabCategories),
  getSmPracticeLabCategoryById: wrap(getSmPracticeLabCategoryById),
  updateSmPracticeLabCategory: wrap(updateSmPracticeLabCategory),
  deleteSmPracticeLabCategory: wrap(deleteSmPracticeLabCategory),

  // ---------- SM Practice Lab - Situations ----------
  addSmPracticeLabSituation: wrap(addSmPracticeLabSituation),
  bulkAddSmPracticeLabSituations: wrap(bulkAddSmPracticeLabSituations),
  getAllSmPracticeLabSituations: wrap(getAllSmPracticeLabSituations),
  getSmPracticeLabSituationById: wrap(getSmPracticeLabSituationById),
  updateSmPracticeLabSituation: wrap(updateSmPracticeLabSituation),
  deleteSmPracticeLabSituation: wrap(deleteSmPracticeLabSituation),
  getSmPracticeLabSituationForApp: wrap(getSmPracticeLabSituationForApp),

  // ---------- SM Practice Lab - Powers ----------
  addSmPracticeLabPower: wrap(addSmPracticeLabPower),
  getAllSmPracticeLabPowers: wrap(getAllSmPracticeLabPowers),
  getSmPracticeLabPowerById: wrap(getSmPracticeLabPowerById),
  updateSmPracticeLabPower: wrap(updateSmPracticeLabPower),
  deleteSmPracticeLabPower: wrap(deleteSmPracticeLabPower),

  // ---------- Stories New ----------
  addStoryNew: wrap(addStoryNew),
  getAllStoriesNew: wrap(getAllStoriesNew),
  getStoryNewById: wrap(getStoryNewById),
  updateStoryNew: wrap(updateStoryNew),
  deleteStoryNew: wrap(deleteStoryNew),
};
