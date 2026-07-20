const { getDb } = require("../dbConfig/dbConnection");
const { ObjectId } = require("mongodb");

const jwt = require("jsonwebtoken");
const utils = require("../utils/utils");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET || "storyland-secret-key-change-me";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "30d";

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
};

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const getStoryNewForApp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.storyId) {
      return reject({ status: 400, message: "storyId required", data: [] });
    }
    db.collection("stories-new")
      .findOne({ _id: new ObjectId(data.storyId) })
      .then((story) =>
        story
          ? resolve({ status: 200, message: "Story fetched", data: [story] })
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

// List of published stories (for the stories home).
const getStoriesNewForApp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = { isActive: true, status: "published" };
    if (data && data.power) query.power = data.power;

    db.collection("stories-new")
      .find(query)
      .project({ screens: 0 })
      .sort({ order: 1, createdAt: -1 })
      .toArray()
      .then((items) =>
        resolve({ status: 200, message: "Stories fetched", data: items }),
      )
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

// Submit an mcq / multiSelect answer for one screen.
const submitStoryNew = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }
    if (!data.storyId) {
      return reject({ status: 400, message: "storyId required", data: [] });
    }
    if (!data.screenId) {
      return reject({ status: 400, message: "screenId required", data: [] });
    }

    db.collection("stories-new")
      .findOne({ _id: new ObjectId(data.storyId) })
      .then((story) => {
        if (!story) {
          return reject({ status: 404, message: "Story not found", data: [] });
        }
        const screen = (story.screens || []).find(
          (s) => String(s._id) === String(data.screenId),
        );
        if (!screen) {
          return reject({ status: 404, message: "Screen not found", data: [] });
        }

        let isCorrect = false;
        if (screen.type === "mcq") {
          isCorrect =
            String(data.answer || "").trim() ===
            String(screen.correct || "").trim();
        } else if (screen.type === "multiSelect") {
          const given = Array.isArray(data.answers)
            ? data.answers.map(String).sort()
            : [];
          const correct = Array.isArray(screen.correct)
            ? screen.correct.map(String).sort()
            : [];
          isCorrect =
            given.length === correct.length &&
            given.every((v, i) => v === correct[i]);
        } else {
          return reject({
            status: 400,
            message: "Screen is not answerable",
            data: [],
          });
        }

        const keysEarned = isCorrect ? Number(screen.smKeyReward) || 0 : 0;

        const entry = {
          userId: data.userId,
          storyId: story._id,
          screenId: String(data.screenId),
          screenType: screen.type,
          answer: data.answer !== undefined ? data.answer : null,
          answers: Array.isArray(data.answers) ? data.answers : [],
          isCorrect: isCorrect,
          keysEarned: keysEarned,
          createdAt: new Date(),
        };

        return db
          .collection("stories-new-submit")
          .insertOne(entry)
          .then(() => {
            if (!isCorrect) {
              return resolve({
                status: 200,
                message: "Not quite. Try again!",
                data: [{ isCorrect: false, keysEarned: 0, sm_key: null }],
              });
            }
            return db
              .collection("users")
              .findOneAndUpdate(
                { _id: new ObjectId(data.userId) },
                {
                  $inc: { sm_key: keysEarned },
                  $set: { updatedAt: new Date() },
                },
                { returnDocument: "after" },
              )
              .then((result) => {
                const user = result && result.value ? result.value : null;
                resolve({
                  status: 200,
                  message: "Answer correct",
                  data: [
                    {
                      isCorrect: true,
                      keysEarned: keysEarned,
                      sm_key: user ? user.sm_key : keysEarned,
                    },
                  ],
                });
              });
          });
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to submit answer",
          data: [],
          error: e.message,
        }),
      );
  });
};

// Grant story rewards once (keys, badges, heart points).
const completeStoryNew = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }
    if (!data.storyId) {
      return reject({ status: 400, message: "storyId required", data: [] });
    }

    const userId = new ObjectId(data.userId);
    const storyId = new ObjectId(data.storyId);

    Promise.all([
      db.collection("stories-new").findOne({ _id: storyId }),
      db
        .collection("stories-new-complete")
        .findOne({ userId: data.userId, storyId: storyId }),
    ])
      .then(([story, already]) => {
        if (!story) {
          return reject({ status: 404, message: "Story not found", data: [] });
        }
        const rewards = story.rewards || {
          smKeys: 0,
          badges: 0,
          heartPoints: 0,
        };

        // already completed - return current totals, no double grant
        if (already) {
          return db
            .collection("users")
            .findOne({ _id: userId })
            .then((user) =>
              resolve({
                status: 200,
                message: "Story already completed",
                data: [
                  {
                    alreadyCompleted: true,
                    rewards: rewards,
                    sm_key: user ? user.sm_key : 0,
                    badges: user ? user.badges : 0,
                    heart_points: user ? user.heart_points : 0,
                  },
                ],
              }),
            );
        }

        return db
          .collection("stories-new-complete")
          .insertOne({
            userId: data.userId,
            storyId: storyId,
            rewards: rewards,
            createdAt: new Date(),
          })
          .then(() =>
            db.collection("users").findOneAndUpdate(
              { _id: userId },
              {
                $inc: {
                  sm_key: Number(rewards.smKeys) || 0,
                  badges: Number(rewards.badges) || 0,
                  heart_points: Number(rewards.heartPoints) || 0,
                },
                $set: { updatedAt: new Date() },
              },
              { returnDocument: "after" },
            ),
          )
          .then((result) => {
            const user = result && result.value ? result.value : null;
            resolve({
              status: 200,
              message: "Story completed",
              data: [
                {
                  alreadyCompleted: false,
                  rewards: rewards,
                  sm_key: user ? user.sm_key : 0,
                  badges: user ? user.badges : 0,
                  heart_points: user ? user.heart_points : 0,
                },
              ],
            });
          });
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Unable to complete story",
          data: [],
          error: e.message,
        }),
      );
  });
};
const submitCoinInvest = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }

    const giving = Number(data.giving) || 0;
    const spending = Number(data.spending) || 0;
    const investing = Number(data.investing) || 0;
    const total = Number(data.totalCoins) || 0;

    if (giving + spending + investing !== total) {
      return reject({
        status: 400,
        message: "Allocation must add up to the total coins",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ _id: new ObjectId(data.userId) })
      .then((user) => {
        if (!user) {
          return reject({ status: 404, message: "User not found", data: [] });
        }
        if ((user.sm_key || 0) < total) {
          return reject({
            status: 400,
            message: "Not enough coins to place",
            data: [],
          });
        }

        const entry = {
          userId: data.userId,
          totalCoins: total,
          giving: giving,
          spending: spending,
          investing: investing,
          createdAt: new Date(),
        };

        return db
          .collection("coin-invest-submit")
          .insertOne(entry)
          .then(() =>
            db.collection("users").findOneAndUpdate(
              { _id: new ObjectId(data.userId) },
              {
                $inc: {
                  sm_key: -total,
                  giving_jar: giving,
                  spending_jar: spending,
                  investing_jar: investing,
                },
                $set: { updatedAt: new Date() },
              },
              { returnDocument: "after" },
            ),
          )
          .then((result) => {
            const updated = result && result.value ? result.value : null;
            resolve({
              status: 200,
              message: "Coins placed",
              data: [
                {
                  giving: giving,
                  spending: spending,
                  investing: investing,
                  sm_key: updated ? updated.sm_key : (user.sm_key || 0) - total,
                  giving_jar: updated ? updated.giving_jar : giving,
                  spending_jar: updated ? updated.spending_jar : spending,
                  investing_jar: updated ? updated.investing_jar : investing,
                },
              ],
            });
          });
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not place coins",
          data: [],
          error: e.message,
        }),
      );
  });
};
const getCoinInvest = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }

    db.collection("users")
      .findOne({ _id: new ObjectId(data.userId) })
      .then((user) => {
        if (!user) {
          return reject({ status: 404, message: "User not found", data: [] });
        }
        resolve({
          status: 200,
          message: "Coins fetched",
          data: [
            {
              totalCoins: user.sm_key || 0,
              growth_gem: user.growth_gem || 0,
              treasure_key: user.treasure_key || 0,
            },
          ],
        });
      })
      .catch((e) =>
        reject({
          status: 400,
          message: "Could not fetch coins",
          data: [],
          error: e.message,
        }),
      );
  });
};
const getSmPracticeLabCategories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data || !data.power) {
      return reject({ status: 400, message: "power required", data: [] });
    }
    db.collection("sm-practice-lab-situation")
      .distinct("category", { isActive: true, power: data.power })
      .then((names) =>
        resolve({
          status: 200,
          message: "Categories fetched",
          data: names
            .filter(Boolean)
            .sort()
            .map((name) => ({ name })),
        }),
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
const getSmPracticeLabPowersForApp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data || !data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }

    Promise.all([
      db
        .collection("sm-practice-lab-power")
        .find({ isActive: true })
        .sort({ name: 1 })
        .toArray(),
      db
        .collection("sm-practice-lab-situation")
        .find({ isActive: true })
        .project({ power: 1 })
        .toArray(),
      db
        .collection("sm-practice-lab-submit")
        .find({ userId: data.userId, isCorrect: true })
        .toArray(),
    ])
      .then(([powers, situations, submits]) => {
        const totals = {};
        situations.forEach((s) => {
          const p = s.power || "";
          totals[p] = (totals[p] || 0) + 1;
        });

        const solvedByPower = {};
        const seen = {};
        submits.forEach((s) => {
          const key = String(s.situationId);
          if (seen[key]) return;
          seen[key] = true;
          const p = s.power || "";
          solvedByPower[p] = (solvedByPower[p] || 0) + 1;
        });

        const items = powers.map((p) => {
          const total = totals[p.name] || 0;
          const solved = solvedByPower[p.name] || 0;
          return {
            _id: p._id,
            name: p.name,
            totalCount: total,
            solvedCount: solved,
            completed: total > 0 && solved >= total,
          };
        });

        resolve({ status: 200, message: "Powers fetched", data: items });
      })
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

const getSmPracticeLabFlow = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const friends = ["blaze", "shello", "champ", "tejix"];

    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }
    if (!data.power) {
      return reject({ status: 400, message: "power required", data: [] });
    }
    if (!data.category) {
      return reject({ status: 400, message: "category required", data: [] });
    }

    const query = {
      isActive: true,
      power: data.power,
      category: data.category,
    };

    Promise.all([
      db
        .collection("sm-practice-lab-situation")
        .find(query)
        .sort({ createdAt: 1 })
        .toArray(),
      db
        .collection("sm-practice-lab-submit")
        .find({
          userId: data.userId,
          power: data.power,
          category: data.category,
          isCorrect: true,
        })
        .toArray(),
    ])
      .then(([situations, submits]) => {
        if (situations.length === 0) {
          return resolve({
            status: 200,
            message: "No situations in this category",
            data: [
              {
                completed: true,
                solvedCount: 0,
                totalCount: 0,
                situation: null,
              },
            ],
          });
        }

        // ids the child has already solved correctly
        const solvedIds = {};
        submits.forEach((s) => {
          solvedIds[String(s.situationId)] = true;
        });

        // first situation, in order, that is not solved yet
        const next = situations.find((s) => !solvedIds[String(s._id)]);
        const solvedCount = situations.filter(
          (s) => solvedIds[String(s._id)],
        ).length;

        if (!next) {
          return resolve({
            status: 200,
            message: "Category completed",
            data: [
              {
                completed: true,
                solvedCount: solvedCount,
                totalCount: situations.length,
                situation: null,
              },
            ],
          });
        }

        // friend texts are shuffled so the drag order is not a giveaway
        const responses = friends.map((f) => ({
          key: f,
          text: next[f],
        }));
        for (let i = responses.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = responses[i];
          responses[i] = responses[j];
          responses[j] = t;
        }

        resolve({
          status: 200,
          message: "Situation fetched",
          data: [
            {
              completed: false,
              solvedCount: solvedCount,
              totalCount: situations.length,
              situationNumber: solvedCount + 1,
              situation: {
                _id: next._id,
                situation: next.situation,
                power: next.power,
                category: next.category,
                level: next.level,
                smKeyReward: next.smKeyReward,
                tejixInsight: next.tejixInsight,
                responses: responses,
              },
            },
          ],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to load practice lab",
          data: [],
          error: error.message,
        });
      });
  });
};

const submitSmPracticeLab = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const friends = ["blaze", "shello", "champ", "tejix"];

    if (!data.userId) {
      return reject({ status: 400, message: "userId required", data: [] });
    }
    if (!data.situationId) {
      return reject({ status: 400, message: "situationId required", data: [] });
    }
    if (!data.answers || typeof data.answers !== "object") {
      return reject({ status: 400, message: "answers required", data: [] });
    }

    db.collection("sm-practice-lab-situation")
      .findOne({ _id: new ObjectId(data.situationId) })
      .then((situation) => {
        if (!situation) {
          return reject({
            status: 404,
            message: "Situation not found",
            data: [],
          });
        }

        // compare each dropped text against the friend it belongs to
        const results = {};
        let correctCount = 0;
        friends.forEach((f) => {
          const given = String(data.answers[f] || "").trim();
          const expected = String(situation[f] || "").trim();
          const ok = given.length > 0 && given === expected;
          results[f] = ok;
          if (ok) correctCount++;
        });

        const isCorrect = correctCount === friends.length;
        const keysEarned = isCorrect ? Number(situation.smKeyReward) || 0 : 0;

        const entry = {
          userId: data.userId,
          situationId: situation._id,
          power: situation.power,
          category: situation.category,
          level: situation.level,
          situationText: situation.situation,
          answers: {
            blaze: String(data.answers.blaze || "").trim(),
            shello: String(data.answers.shello || "").trim(),
            champ: String(data.answers.champ || "").trim(),
            tejix: String(data.answers.tejix || "").trim(),
          },
          results: results,
          correctCount: correctCount,
          isCorrect: isCorrect,
          keysEarned: keysEarned,
          createdAt: new Date(),
        };

        return db
          .collection("sm-practice-lab-submit")
          .insertOne(entry)
          .then(() => {
            // wrong attempt: recorded, no keys, child can retry
            if (!isCorrect) {
              return resolve({
                status: 200,
                message: "Not quite. Try again!",
                data: [
                  {
                    isCorrect: false,
                    correctCount: correctCount,
                    results: results,
                    keysEarned: 0,
                    tejixInsight: situation.tejixInsight || "",
                    sm_key: null,
                  },
                ],
              });
            }

            return db
              .collection("users")
              .findOneAndUpdate(
                { _id: new ObjectId(data.userId) },
                {
                  $inc: { sm_key: keysEarned },
                  $set: { updatedAt: new Date() },
                },
                { returnDocument: "after" },
              )
              .then((result) => {
                const user = result && result.value ? result.value : null;
                resolve({
                  status: 200,
                  message: "Practice lab completed",
                  data: [
                    {
                      isCorrect: true,
                      correctCount: correctCount,
                      results: results,
                      keysEarned: keysEarned,
                      tejixInsight: situation.tejixInsight || "",
                      sm_key: user ? user.sm_key : keysEarned,
                    },
                  ],
                });
              });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to submit practice lab",
          data: [],
          error: error.message,
        });
      });
  });
};
const submitTreasureHunt = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.userId) {
      return reject({
        status: 400,
        message: "userId required",
        data: [],
      });
    }
    if (data.chosenPath !== "A" && data.chosenPath !== "B") {
      return reject({
        status: 400,
        message: "chosenPath must be A or B",
        data: [],
      });
    }

    const rewards =
      data.chosenPath === "B"
        ? { smPoints: 10, treasureKey: 1, growthGem: 1 }
        : { smPoints: 0, treasureKey: 0, growthGem: 0 };

    // Full snapshot of the hunt, not just the chosen path
    const entry = {
      userId: data.userId,
      huntId: data.huntId || "",
      situation: data.situation || "",
      correctCharacter: data.correctCharacter || "",
      friendPicked: data.friendPicked || "",
      whoShowedUp: data.whoShowedUp || "",
      paths: Array.isArray(data.paths) ? data.paths : [],
      chosenPath: data.chosenPath,
      rewards: rewards,
      createdAt: new Date(),
    };

    db.collection("treasure-hunt-submit")
      .insertOne(entry)
      .then(() => {
        return db
          .collection("users")
          .findOneAndUpdate(
            { _id: new ObjectId(data.userId) },
            {
              $inc: {
                sm_key: rewards.smPoints,
                treasure_key: rewards.treasureKey,
                growth_gem: rewards.growthGem,
              },
              $set: { updatedAt: new Date() },
            },
            { returnDocument: "after" },
          )
          .then((result) => {
            const user = result && result.value ? result.value : null;
            resolve({
              status: 200,
              message: "Treasure hunt completed",
              data: [
                {
                  alreadyDone: false,
                  sm_key: user ? user.sm_key : rewards.smPoints,
                  treasure_key: user ? user.treasure_key : rewards.treasureKey,
                  growth_gem: user ? user.growth_gem : rewards.growthGem,
                  rewards: rewards,
                },
              ],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to complete treasure hunt",
          data: [],
          error: error.message,
        });
      });
  });
};

const getTreasureHunt = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    db.collection("treasure_hunt")
      .aggregate([{ $sample: { size: 1 } }])
      .toArray()
      .then((treasureHunt) => {
        resolve({
          status: 200,
          message: "Treasure Hunt loaded successfully",
          data: treasureHunt,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to load Treasure Hunt",
          data: [],
          error: error.message,
        });
      });
  });
};
const getEveningFlow = (userId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!userId) {
      return reject({
        status: 400,
        message: "userId required",
        data: [],
      });
    }
    // const { start, end } = dayBounds();

    // ---- daily check disabled for now ----
    // db.collection("eveningEntries")
    //   .findOne({
    //     userId: userId,
    //     createdAt: { $gte: start, $lte: end },
    //   })
    //   .then((existing) => {
    //     if (existing) {
    //       return resolve({
    //         status: 200,
    //         message: "Evening already done today",
    //         data: [
    //           {
    //             alreadyDone: true,
    //             completedField: existing.createdAt,
    //             homeResponsibility: [],
    //             helpCategories: [],
    //             helpActions: [],
    //           },
    //         ],
    //       });
    //     }

    Promise.all([
      db
        .collection("responsibility_management")
        .find({ isActive: true })
        .limit(10)
        .toArray(),
      db
        .collection("helpful-action-categories")
        .find({ isActive: true })
        .limit(10)
        .toArray(),
      db
        .collection("helpful-actions")
        .find({ isActive: true })
        .limit(50)
        .toArray(),
    ])
      .then(([homeResponsibility, helpCategories, helpActions]) => {
        resolve({
          status: 200,
          message: "Evening flow",
          data: [
            {
              alreadyDone: false,
              completedField: null,
              homeResponsibility: homeResponsibility,
              helpCategories: helpCategories,
              helpActions: helpActions,
            },
          ],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to load evening flow",
          data: [],
          error: error.message,
        });
      });
  });
};
// const getEveningFlow = (userId) => {
//   return new Promise((resolve, reject) => {
//     const db = getDb();
//     if (!userId) {
//       return reject({
//         status: 400,
//         message: "userId required",
//         data: [],
//       });
//     }
//     const { start, end } = dayBounds();

//     db.collection("eveningEntries")
//       .findOne({
//         userId: userId,
//         createdAt: { $gte: start, $lte: end },
//       })
//       .then((existing) => {
//         if (existing) {
//           return resolve({
//             status: 200,
//             message: "Evening already done today",
//             data: [
//               {
//                 alreadyDone: true,
//                 completedField: existing.createdAt,
//                 homeResponsibility: [],
//                 helpCategories: [],
//                 helpActions: [],
//               },
//             ],
//           });
//         }

//         return Promise.all([
//           db
//             .collection("responsibility_management")
//             .find({ isActive: true })
//             .limit(10)
//             .toArray(),
//           db
//             .collection("helpful-action-categories")
//             .find({ isActive: true })
//             .limit(10)
//             .toArray(),
//           db
//             .collection("helpful-actions")
//             .find({ isActive: true })
//             .limit(50)
//             .toArray(),
//         ]).then(([homeResponsibility, helpCategories, helpActions]) => {
//           resolve({
//             status: 200,
//             message: "Evening flow",
//             data: [
//               {
//                 alreadyDone: false,
//                 completedField: null,
//                 homeResponsibility: homeResponsibility,
//                 helpCategories: helpCategories,
//                 helpActions: helpActions,
//               },
//             ],
//           });
//         });
//       })
//       .catch((error) => {
//         reject({
//           status: 400,
//           message: "Unable to load evening flow",
//           data: [],
//           error: error.message,
//         });
//       });
//   });
// };

const completeEvening = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.userId) {
      return reject({
        status: 400,
        message: "userId required",
        data: [],
      });
    }
    const { start, end } = dayBounds();

    db.collection("eveningEntries")
      .findOne({
        userId: data.userId,
        createdAt: { $gte: start, $lte: end },
      })
      .then((existing) => {
        if (existing) {
          return resolve({
            status: 200,
            message: "Evening already done today",
            data: [{ alreadyDone: true, sm_key: null }],
          });
        }

        const entry = {
          userId: data.userId,
          homeResponsibility: data.homeResponsibility || "",
          helpCategory: data.helpCategory || "",
          helpAction: data.helpAction || "",
          whoShowedUp: data.whoShowedUp || "",
          totalKeysEarned: Number(data.totalKeysEarned) || 0,
          createdAt: new Date(),
        };

        return db
          .collection("eveningEntries")
          .insertOne(entry)
          .then(() => {
            const keys = Number(data.totalKeysEarned) || 0;
            return db
              .collection("users")
              .findOneAndUpdate(
                { _id: new ObjectId(data.userId) },
                { $inc: { sm_key: keys }, $set: { updatedAt: new Date() } },
                { returnDocument: "after" },
              )
              .then((result) => {
                const user = result && result.value ? result.value : null;
                resolve({
                  status: 200,
                  message: "Evening completed",
                  data: [
                    { alreadyDone: false, sm_key: user ? user.sm_key : keys },
                  ],
                });
              });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to complete evening",
          data: [],
          error: error.message,
        });
      });
  });
};
const getMorningFlow = (userId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!userId) {
      return reject({
        status: 400,
        message: "userId required",
        data: [],
      });
    }
    // const { start, end } = dayBounds();

    // ---- daily check disabled for now ----
    // db.collection("morningEntries")
    //   .findOne({
    //     userId: userId,
    //     createdAt: { $gte: start, $lte: end },
    //   })
    //   .then((existing) => {
    //     if (existing) {
    //       return resolve({
    //         status: 200,
    //         message: "Morning already done today",
    //         data: [
    //           {
    //             alreadyDone: true,
    //             completedField: existing.createdAt,
    //             gratitude: [],
    //             greeting: [],
    //             responsibility: [],
    //             practiceLab: null,
    //           },
    //         ],
    //       });
    //     }

    Promise.all([
      db
        .collection("gratitude-pause")
        .find({ isActive: true })
        .limit(10)
        .toArray(),
      db
        .collection("greeting-challenge")
        .find({ isActive: true })
        .limit(10)
        .toArray(),
      db
        .collection("responsibility_management")
        .find({ isActive: true })
        .limit(10)
        .toArray(),
      db
        .collection("practice-lab-situation")
        .aggregate([{ $match: { isActive: true } }, { $sample: { size: 1 } }])
        .toArray(),
    ])
      .then(([gratitude, greeting, responsibility, practice]) => {
        resolve({
          status: 200,
          message: "Morning flow",
          data: [
            {
              alreadyDone: false,
              completedField: null,
              gratitude: gratitude,
              greeting: greeting,
              responsibility: responsibility,
              practiceLab: practice.length > 0 ? practice[0] : null,
            },
          ],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to load morning flow",
          data: [],
          error: error.message,
        });
      });
  });
};
// const getMorningFlow = (userId) => {
//   return new Promise((resolve, reject) => {
//     const db = getDb();
//     if (!userId) {
//       return reject({
//         status: 400,
//         message: "userId required",
//         data: [],
//       });
//     }
//     const { start, end } = dayBounds();

//     db.collection("morningEntries")
//       .findOne({
//         userId: userId,
//         createdAt: { $gte: start, $lte: end },
//       })
//       .then((existing) => {
//         if (existing) {
//           return resolve({
//             status: 200,
//             message: "Morning already done today",
//             data: [
//               {
//                 alreadyDone: true,
//                 completedField: existing.createdAt,
//                 gratitude: [],
//                 greeting: [],
//                 responsibility: [],
//                 practiceLab: null,
//               },
//             ],
//           });
//         }

//         return Promise.all([
//           db
//             .collection("gratitude-pause")
//             .find({ isActive: true })
//             .limit(10)
//             .toArray(),
//           db
//             .collection("greeting-challenge")
//             .find({ isActive: true })
//             .limit(10)
//             .toArray(),
//           db
//             .collection("responsibility_management")
//             .find({ isActive: true })
//             .limit(10)
//             .toArray(),
//           db
//             .collection("practice-lab-situation")
//             .aggregate([
//               { $match: { isActive: true } },
//               { $sample: { size: 1 } },
//             ])
//             .toArray(),
//         ]).then(([gratitude, greeting, responsibility, practice]) => {
//           resolve({
//             status: 200,
//             message: "Morning flow",
//             data: [
//               {
//                 alreadyDone: false,
//                 completedField: null,
//                 gratitude: gratitude,
//                 greeting: greeting,
//                 responsibility: responsibility,
//                 practiceLab: practice.length > 0 ? practice[0] : null,
//               },
//             ],
//           });
//         });
//       })
//       .catch((error) => {
//         reject({
//           status: 400,
//           message: "Unable to load morning flow",
//           data: [],
//           error: error.message,
//         });
//       });
//   });
// };

const completeMorning = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.userId) {
      return reject({
        status: 400,
        message: "userId required",
        data: [],
      });
    }
    const { start, end } = dayBounds();

    db.collection("morningEntries")
      .findOne({
        userId: data.userId,
        createdAt: { $gte: start, $lte: end },
      })
      .then((existing) => {
        if (existing) {
          return resolve({
            status: 200,
            message: "Morning already done today",
            data: [{ alreadyDone: true, sm_key: null }],
          });
        }

        const entry = {
          userId: data.userId,
          gratitude: data.gratitude || [],
          greeting: data.greeting || [],
          responsibility: data.responsibility || "",
          practiceLab: data.practiceLab || {},
          totalKeysEarned: Number(data.totalKeysEarned) || 0,
          createdAt: new Date(),
        };

        return db
          .collection("morningEntries")
          .insertOne(entry)
          .then(() => {
            const keys = Number(data.totalKeysEarned) || 0;
            return db
              .collection("users")
              .findOneAndUpdate(
                { _id: new ObjectId(data.userId) },
                { $inc: { sm_key: keys }, $set: { updatedAt: new Date() } },
                { returnDocument: "after" },
              )
              .then((result) => {
                const user = result && result.value ? result.value : null;
                resolve({
                  status: 200,
                  message: "Morning completed",
                  data: [
                    { alreadyDone: false, sm_key: user ? user.sm_key : keys },
                  ],
                });
              });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to complete morning",
          data: [],
          error: error.message,
        });
      });
  });
};

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      mobile: user.mobile,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, otp, otpExpiry, ...safe } = user;
  return safe;
};

/* ============================================================
   AUTH - SIGNUP / LOGIN / OTP
   ============================================================ */

const createUser = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.mobile || data.mobile.length !== 10) {
      return reject({
        status: 400,
        message: "Valid 10-digit mobile number required",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ mobile: data.mobile })
      .then((existing) => {
        if (existing) {
          return reject({
            status: 409,
            message: "User already exists with this mobile",
            data: [],
          });
        }
        const user = {
          name: data.name || "",
          email: data.email || "",
          mobile: data.mobile,
          countryCode: data.countryCode || "+91",
          password: data.password ? bcrypt.hashSync(data.password, 10) : null,
          image: data.image || "",
          role: "Reader",
          status: "Active",
          isPremium: false,
          storiesPublished: 0,
          storiesRead: 0,
          favorites: [],
          readingHistory: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return db
          .collection("users")
          .insertOne(user)
          .then((result) => {
            const newUser = { _id: result.insertedId, ...user };
            const token = generateToken(newUser);
            resolve({
              status: 200,
              message: "User created",
              data: [{ user: sanitizeUser(newUser), token }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to create user",
          data: [],
          error: error.message,
        });
      });
  });
};

const sendOtp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const mobile = data.mobile;

    if (!mobile || mobile.length !== 10) {
      return reject({
        status: 400,
        message: "Valid 10-digit mobile number required",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ mobile: mobile })
      .then((result) => {
        if (result) {
          // Existing user - send OTP
          utils
            .sendOtp(mobile)
            .then((result1) => {
              console.log(
                "result of otp sending message",
                result1["sessionId"],
              );
              const token = jwt.sign(
                { user_id: result["_id"], mobile: mobile },
                process.env.JWT_KEY,
                { expiresIn: process.env.expiresIn },
              );
              resolve({
                status: 200,
                message: "OTP sent successfully!",
                data: [
                  {
                    token: token,
                    name: result["name"] || "",
                    user_id: result["_id"],
                    sessionId: result1["sessionId"],
                  },
                ],
              });
            })
            .catch((err) => {
              console.log("error sending OTP", err);
              reject({
                status: 400,
                message: "Unable to send OTP.",
                data: [],
              });
            });
        } else {
          // New user - create then send OTP
          db.collection("users")
            .insertOne({
              name: "",
              email: "",
              mobile: mobile,
              countryCode: data.countryCode || "+91",
              role: "Reader",
              status: "Active",
              isPremium: false,
              storiesPublished: 0,
              storiesRead: 0,
              favorites: [],
              readingHistory: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .then((result1) => {
              utils
                .sendOtp(mobile)
                .then((result) => {
                  console.log(
                    "result of otp sending message",
                    result["sessionId"],
                  );
                  const token = jwt.sign(
                    {
                      user_id: result1["insertedId"],
                      mobile: mobile,
                    },
                    process.env.JWT_KEY,
                    { expiresIn: process.env.expiresIn },
                  );
                  resolve({
                    status: 200,
                    message: "OTP sent successfully!",
                    data: [
                      {
                        token: token,
                        name: "",
                        user_id: result1["insertedId"],
                        sessionId: result["sessionId"],
                      },
                    ],
                  });
                })
                .catch((err) => {
                  console.log("error sending OTP", err);
                  reject({
                    status: 400,
                    message: "Unable to send OTP.",
                    data: [],
                  });
                });
            })
            .catch((error) => {
              console.log("error creating user", error);
              reject({
                status: 500,
                message: "Unable to send OTP.",
                data: [],
              });
            });
        }
      })
      .catch((err) => {
        console.log("error finding user", err);
        reject({
          status: 400,
          message: "Unable to send OTP.",
          data: [],
        });
      });
  });
};

const verifyOtp = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { mobile, otp, sessionId } = data;

    if (!mobile || !otp) {
      return reject({
        status: 400,
        message: "Mobile, OTP and sessionId are required",
        data: [],
      });
    }

    utils
      .verifyOtp(data)
      .then((result) => {
        console.log("result of otp match", result);

        return db.collection("users").findOne({ mobile: mobile });
      })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found. Please request OTP first.",
            data: [],
          });
        }
        if (user.status === "Suspended") {
          return reject({
            status: 403,
            message: "Your account has been suspended.",
            data: [],
          });
        }

        return db
          .collection("users")
          .updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date(), updatedAt: new Date() } },
          )
          .then(() => {
            const token = jwt.sign(
              { user_id: user._id, mobile: mobile },
              process.env.JWT_KEY,
              { expiresIn: process.env.expiresIn },
            );
            const { password, ...safeUser } = user;
            resolve({
              status: 200,
              message: "OTP verified successfully!",
              data: [{ ...safeUser, token }],
            });
          });
      })
      .catch((err) => {
        console.log("error verify OTP", err);
        if (err && err.status) {
          return reject(err);
        }
        reject({
          status: 400,
          message: "OTP incorrect.",
          data: [],
        });
      });
  });
};

const loginWithPassword = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { email, mobile, password } = data;
    if (!password || (!email && !mobile)) {
      return reject({
        status: 400,
        message: "Email/mobile and password are required",
        data: [],
      });
    }

    const filter = email ? { email } : { mobile };
    db.collection("users")
      .findOne(filter)
      .then((user) => {
        if (!user || !user.password) {
          return reject({
            status: 404,
            message: "Invalid credentials",
            data: [],
          });
        }
        if (user.status === "Suspended") {
          return reject({
            status: 403,
            message: "Your account has been suspended.",
            data: [],
          });
        }
        const matches = bcrypt.compareSync(password, user.password);
        if (!matches) {
          return reject({
            status: 401,
            message: "Invalid credentials",
            data: [],
          });
        }
        return db
          .collection("users")
          .updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date(), updatedAt: new Date() } },
          )
          .then(() => {
            const token = generateToken(user);
            resolve({
              status: 200,
              message: "Login successful",
              data: [{ user: sanitizeUser(user), token }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to login",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   PROFILE
   ============================================================ */

const getProfile = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    console.log("user id", data.userId);
    const userObjId = toObjectId(data.userId);
    if (!userObjId) {
      return reject({
        status: 400,
        message: "Invalid user ID",
        data: [],
      });
    }
    db.collection("users")
      .findOne({ _id: userObjId })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        resolve({
          status: 200,
          message: "Profile fetched",
          data: [sanitizeUser(user)],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch profile",
          data: [],
          error: error.message,
        });
      });
  });
};

const updateProfile = (data) => {
  console.log("user id", data);
  return new Promise((resolve, reject) => {
    const db = getDb();
    const updates = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    if (data.image !== undefined) updates.image = data.image;
    if (data.quote !== undefined) updates.quote = data.quote;

    db.collection("users")
      .updateOne({ _id: new ObjectId(data.userId) }, { $set: updates })
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

const changePassword = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, oldPassword, newPassword } = data;
    if (!newPassword || newPassword.length < 6) {
      return reject({
        status: 400,
        message: "New password must be at least 6 characters",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        if (user.password) {
          const matches = bcrypt.compareSync(oldPassword || "", user.password);
          if (!matches) {
            return reject({
              status: 401,
              message: "Old password is incorrect",
              data: [],
            });
          }
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        return db
          .collection("users")
          .updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashed, updatedAt: new Date() } },
          );
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Password updated",
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

const deleteAccount = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .deleteOne({ _id: new ObjectId(data.userId) })
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
          message: "Account deleted",
          data: [],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to delete account",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   STORIES - USER FACING (read, browse, search)
   ============================================================ */

const getHomeFeed = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    Promise.all([
      db
        .collection("stories")
        .find({ status: "published" })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),

      db.collection("stories").countDocuments({ status: "published" }),

      db.collection("categories").find({ isActive: true }).toArray(),

      data && data.userId && ObjectId.isValid(data.userId)
        ? db.collection("users").findOne({ _id: new ObjectId(data.userId) })
        : Promise.resolve(null),
    ])
      .then(async ([stories, totalStories, categories, user]) => {
        const COMPLETED_THRESHOLD = 1;

        let resumeStories = [];
        let continueReading = null;
        let storiesCompleted = 0;

        if (user && Array.isArray(user.readingHistory)) {
          // Unfinished stories
          resumeStories = user.readingHistory.filter(
            (h) => (h.progress || 0) < COMPLETED_THRESHOLD,
          );

          resumeStories.sort((a, b) => {
            const aDate = new Date(a.updatedAt || a.startedAt || 0).getTime();
            const bDate = new Date(b.updatedAt || b.startedAt || 0).getTime();
            return bDate - aDate;
          });

          if (resumeStories.length > 0) {
            continueReading = resumeStories[0];
          }

          // Get storyIds where progress === 1
          const completedEntries = user.readingHistory.filter(
            (h) => (h.progress || 0) === COMPLETED_THRESHOLD,
          );

          if (completedEntries.length > 0) {
            // Only count stories that still exist in the stories collection
            const completedIds = completedEntries
              .filter(
                (h) => h.storyId && ObjectId.isValid(h.storyId.toString()),
              )
              .map((h) => new ObjectId(h.storyId.toString()));

            storiesCompleted = await db
              .collection("stories")
              .countDocuments({ _id: { $in: completedIds } });
          }
        }

        console.log("Home feed - completed:", storiesCompleted);
        console.log("Home feed - resume:", resumeStories.length);

        resolve({
          status: 200,
          message: "Home feed fetched",
          data: [
            {
              totalStories: totalStories,
              storiesCompleted: storiesCompleted,
              resumeStoriesCount: resumeStories.length,
              continueReading,
              featuredStories: stories,
              categories,
            },
          ],
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch home feed",
          data: [],
          error: error.message,
        });
      });
  });
};
// App-facing paginated stories list (cursor pagination, no category).
// Returns light docs (no screens) with the fields StoryGridCard reads.
const getStoriesByCategory = (filters) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = { status: "published", isActive: true };

    // optional power filter
    if (filters && filters.power) {
      query.power = filters.power;
    }

    // cursor: fetch items older than lastId
    if (filters && filters.lastId) {
      try {
        query._id = { $lt: new ObjectId(filters.lastId) };
      } catch (e) {
        return reject({
          status: 400,
          message: "Invalid lastId",
          data: [],
        });
      }
    }

    const limit = parseInt(filters && filters.limit) || 20;
    const sortField =
      filters && filters.sort === "views"
        ? { views: -1, _id: -1 }
        : { _id: -1 };

    db.collection("stories-new")
      .find(query)
      .project({ screens: 0 }) // list is light, no screens
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

// const getStoriesByCategory = (filters) => {
//   return new Promise((resolve, reject) => {
//     const db = getDb();
//     const query = { status: "published" };

//     if (filters.categoryId) {
//       try {
//         query.categoryId = new ObjectId(filters.categoryId);
//       } catch (e) {
//         return reject({
//           status: 400,
//           message: "Invalid category id",
//           data: [],
//         });
//       }
//     }

//     if (filters.lastId) {
//       query._id = { $lt: new ObjectId(filters.lastId) };
//     }

//     const limit = parseInt(filters.limit) || 20;
//     const sortField =
//       filters.sort === "views" ? { views: -1, _id: -1 } : { _id: -1 };

//     db.collection("stories")
//       .find(query)
//       .sort(sortField)
//       .limit(limit)
//       .toArray()
//       .then((stories) => {
//         const hasMore = stories.length === limit;
//         const lastId =
//           stories.length > 0
//             ? stories[stories.length - 1]._id.toString()
//             : null;
//         resolve({
//           status: 200,
//           message: "Stories fetched",
//           data: stories,
//           pagination: { hasMore, lastId, limit },
//         });
//       })
//       .catch((error) => {
//         reject({
//           status: 400,
//           message: "Could not fetch stories",
//           data: [],
//           error: error.message,
//         });
//       });
//   });
// };

const getStoryDetails = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const storyId = data.storyId;
    const userId = data.userId;

    if (!storyId || !ObjectId.isValid(storyId)) {
      return reject({
        status: 400,
        message: "Valid storyId is required",
        data: [],
      });
    }

    db.collection("stories")
      .findOneAndUpdate(
        { _id: new ObjectId(storyId), status: "published" },
        { $inc: { views: 1 } },
        { returnDocument: "after" },
      )
      .then(async (result) => {
        const story = result.value || result;
        if (!story) {
          return reject({
            status: 404,
            message: "Story not found",
            data: [],
          });
        }

        // Attach user's reading progress and favorite status if logged in
        let lastReadSentence = 0;
        let totalSentences = 0;
        let progress = 0;
        let isFavorite = false;

        if (userId && ObjectId.isValid(userId)) {
          try {
            const user = await db
              .collection("users")
              .findOne(
                { _id: new ObjectId(userId) },
                { projection: { readingHistory: 1, favorites: 1 } },
              );

            if (user) {
              const history = (user.readingHistory || []).find(
                (h) => h.storyId?.toString() === storyId.toString(),
              );
              if (history) {
                lastReadSentence = history.lastReadSentence || 0;
                totalSentences = history.totalSentences || 0;
                progress = history.progress || 0;
              }

              const favorites = user.favorites || [];
              isFavorite = favorites.some(
                (f) => f?.toString() === storyId.toString(),
              );
            }
          } catch (e) {
            console.warn("Could not fetch user progress:", e.message);
          }
        }

        resolve({
          status: 200,
          message: "Story fetched",
          data: [
            {
              ...story,
              lastReadSentence,
              totalSentences,
              progress,
              isFavorite,
            },
          ],
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

const searchStories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = data.query || "";
    if (!query.trim()) {
      return resolve({
        status: 200,
        message: "Search results",
        data: [],
      });
    }
    db.collection("stories")
      .find({
        status: "published",
        $or: [
          { title: { $regex: query, $options: "i" } },
          { author: { $regex: query, $options: "i" } },
          { summary: { $regex: query, $options: "i" } },
          { categoryName: { $regex: query, $options: "i" } },
        ],
      })
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Search results",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Search failed",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   MY STORIES - user's own stories (drafts + published)
   ============================================================ */

const getMyStories = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const userId = data.userId;

    if (!userId || !ObjectId.isValid(userId)) {
      return reject({
        status: 400,
        message: "Valid userId is required",
        data: [],
      });
    }

    db.collection("users")
      .findOne(
        { _id: new ObjectId(userId) },
        { projection: { readingHistory: 1 } },
      )
      .then(async (user) => {
        if (
          !user ||
          !Array.isArray(user.readingHistory) ||
          user.readingHistory.length === 0
        ) {
          return resolve({
            status: 200,
            message: "My stories fetched",
            data: [],
          });
        }

        // Get all storyIds from history
        const storyIds = user.readingHistory
          .filter((h) => h.storyId && ObjectId.isValid(h.storyId.toString()))
          .map((h) => new ObjectId(h.storyId.toString()));

        // Fetch all stories in one query
        const stories = await db
          .collection("stories")
          .find(
            { _id: { $in: storyIds } },
            {
              projection: {
                title: 1,
                author: 1,
                coverImageUrl: 1,
                categoryName: 1,
              },
            },
          )
          .toArray();

        // Build a lookup map by storyId string
        const storyMap = {};
        for (const s of stories) {
          storyMap[s._id.toString()] = s;
        }

        // Enrich each history entry with story fields
        const enriched = user.readingHistory
          .filter((h) => h.storyId)
          .map((h) => {
            const sid = h.storyId.toString();
            const story = storyMap[sid] || {};
            return {
              storyId: sid,
              title: story.title || "Untitled",
              author: story.author || "",
              coverImageUrl: story.coverImageUrl || "",
              categoryName: story.categoryName || "",
              progress: h.progress || 0,
              lastReadSentence: h.lastReadSentence || 0,
              totalSentences: h.totalSentences || 0,
              startedAt: h.startedAt || null,
              completedAt: h.completedAt || null,
              updatedAt: h.updatedAt || h.startedAt || null,
            };
          })
          .sort((a, b) => {
            const aDate = new Date(a.updatedAt || 0).getTime();
            const bDate = new Date(b.updatedAt || 0).getTime();
            return bDate - aDate;
          });

        resolve({
          status: 200,
          message: "My stories fetched",
          data: enriched,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch your stories",
          data: [],
          error: error.message,
        });
      });
  });
};

const createMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!data.title || !data.content) {
      return reject({
        status: 400,
        message: "Title and content are required",
        data: [],
      });
    }
    const story = {
      title: data.title,
      authorId: new ObjectId(data.userId),
      author: data.authorName || "",
      coverImage: data.coverImage || "",
      coverImageUrl: data.coverImageUrl || "",
      categoryId: data.categoryId ? new ObjectId(data.categoryId) : null,
      categoryName: data.categoryName || "",
      summary: data.summary || "",
      content: data.content,
      status: data.status || "draft",
      views: 0,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.collection("stories")
      .insertOne(story)
      .then((result) => {
        // Bump user's storiesPublished count if published
        if (story.status === "published") {
          db.collection("users").updateOne(
            { _id: new ObjectId(data.userId) },
            { $inc: { storiesPublished: 1 } },
          );
        }
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

const updateMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, storyId } = data;
    const updates = { updatedAt: new Date() };
    if (data.title) updates.title = data.title;
    if (data.coverImage !== undefined) updates.coverImage = data.coverImage;
    if (data.coverImageUrl !== undefined)
      updates.coverImageUrl = data.coverImageUrl;
    if (data.categoryId) {
      updates.categoryId = new ObjectId(data.categoryId);
      updates.categoryName = data.categoryName || "";
    }
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.content) updates.content = data.content;
    if (data.status) updates.status = data.status;

    db.collection("stories")
      .updateOne(
        { _id: new ObjectId(storyId), authorId: new ObjectId(userId) },
        { $set: updates },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found or not yours",
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

const deleteMyStory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("stories")
      .deleteOne({
        _id: new ObjectId(data.storyId),
        authorId: new ObjectId(data.userId),
      })
      .then((result) => {
        if (result.deletedCount === 0) {
          return reject({
            status: 404,
            message: "Story not found or not yours",
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

/* ============================================================
   FAVORITES / LIKES
   ============================================================ */

const toggleFavorite = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { userId, storyId } = data;
    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        const favorites = user.favorites || [];
        const exists = favorites.some((id) => id.toString() === storyId);
        const operation = exists
          ? { $pull: { favorites: new ObjectId(storyId) }, $inc: {} }
          : { $addToSet: { favorites: new ObjectId(storyId) }, $inc: {} };
        return db
          .collection("users")
          .updateOne({ _id: new ObjectId(userId) }, operation)
          .then(() => {
            // Update story's like count
            return db
              .collection("stories")
              .updateOne(
                { _id: new ObjectId(storyId) },
                { $inc: { likes: exists ? -1 : 1 } },
              );
          })
          .then(() => {
            resolve({
              status: 200,
              message: exists ? "Removed from favorites" : "Added to favorites",
              data: [{ favorited: !exists }],
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to toggle favorite",
          data: [],
          error: error.message,
        });
      });
  });
};

const getFavorites = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("users")
      .findOne({ _id: new ObjectId(data.userId) })
      .then((user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }
        const favIds = user.favorites || [];
        if (favIds.length === 0) {
          return resolve({
            status: 200,
            message: "Favorites fetched",
            data: [],
          });
        }
        return db
          .collection("stories")
          .find({ _id: { $in: favIds } })
          .toArray()
          .then((stories) => {
            resolve({
              status: 200,
              message: "Favorites fetched",
              data: stories,
            });
          });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch favorites",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   READING PROGRESS
   ============================================================ */

const saveReadingProgress = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const { storyId, currentPage, totalPages, progress, user_id } = data;

    if (!storyId) {
      return reject({
        status: 400,
        message: "storyId is required",
        data: [],
      });
    }
    if (!user_id || !ObjectId.isValid(user_id)) {
      return reject({
        status: 400,
        message: "Valid user_id is required",
        data: [],
      });
    }

    const now = new Date();
    const entry = {
      storyId: storyId,
      lastReadSentence: parseInt(currentPage) || 0,
      totalSentences: parseInt(totalPages) || 0,
      progress: parseFloat(progress) || 0,
      updatedAt: now,
    };

    db.collection("users")
      .updateOne(
        {
          _id: new ObjectId(user_id),
          "readingHistory.storyId": storyId,
        },
        {
          $set: {
            "readingHistory.$.lastReadSentence": entry.lastReadSentence,
            "readingHistory.$.totalSentences": entry.totalSentences,
            "readingHistory.$.progress": entry.progress,
            "readingHistory.$.updatedAt": entry.updatedAt,
          },
        },
      )
      .then((result) => {
        if (result.matchedCount === 0) {
          return db.collection("users").updateOne(
            { _id: new ObjectId(user_id) },
            {
              $push: {
                readingHistory: {
                  ...entry,
                  startedAt: now,
                },
              },
            },
          );
        }
        return result;
      })
      .then(() => {
        if (entry.progress >= 0.95) {
          return db.collection("users").updateOne(
            {
              _id: new ObjectId(user_id),
              "readingHistory.storyId": storyId,
              "readingHistory.completedAt": { $exists: false },
            },
            {
              $set: { "readingHistory.$.completedAt": now },
              $inc: { storiesRead: 1 },
            },
          );
        }
      })
      .then(() => {
        resolve({
          status: 200,
          message: "Progress saved",
          data: [entry],
        });
      })
      .catch((err) => {
        console.log("saveReadingProgress error:", err);
        reject({
          status: 400,
          message: "Could not save progress",
          data: [],
          error: err.message,
        });
      });
  });
};
const getReadingHistory = (data) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const userId = data.userId;

    if (!userId || !ObjectId.isValid(userId)) {
      return reject({
        status: 400,
        message: "Valid user ID is required",
        data: [],
      });
    }

    db.collection("users")
      .findOne({ _id: new ObjectId(userId) })
      .then(async (user) => {
        if (!user) {
          return reject({
            status: 404,
            message: "User not found",
            data: [],
          });
        }

        const history = user.readingHistory || [];
        if (history.length === 0) {
          return resolve({
            status: 200,
            message: "Reading history fetched",
            data: [],
          });
        }

        const storyIds = history
          .map((h) => h.storyId)
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        const stories = await db
          .collection("stories")
          .find({ _id: { $in: storyIds } })
          .toArray();

        const storyMap = {};
        stories.forEach((s) => {
          storyMap[s._id.toString()] = s;
        });

        const enriched = history
          .map((h) => {
            const story = storyMap[h.storyId];
            if (!story) return null;
            return {
              storyId: h.storyId,
              title: story.title,
              author: story.author,
              coverImageUrl: story.coverImageUrl || story.coverImage || "",
              categoryName: story.categoryName || "",
              lastReadSentence: h.lastReadSentence || 0,
              totalSentences: h.totalSentences || 0,
              progress: h.progress || 0,
              updatedAt: h.updatedAt,
              startedAt: h.startedAt,
            };
          })
          .filter(Boolean)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        resolve({
          status: 200,
          message: "Reading history fetched",
          data: enriched,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch reading history",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   CATEGORIES (read-only for users)
   ============================================================ */

const getCategories = () => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.collection("categories")
      .find({ isActive: true })
      .toArray()
      .then((result) => {
        resolve({
          status: 200,
          message: "Categories fetched",
          data: result,
        });
      })
      .catch((error) => {
        reject({
          status: 400,
          message: "Unable to fetch categories",
          data: [],
          error: error.message,
        });
      });
  });
};

/* ============================================================
   JWT MIDDLEWARE (export for use in routes)
   ============================================================ */

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      status: 401,
      message: "No token provided",
      data: [],
    });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userMobile = decoded.mobile;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({
      status: 401,
      message: "Invalid or expired token",
      data: [],
    });
  }
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
  createUser: wrap(createUser),
  sendOtp: wrap(sendOtp),
  verifyOtp: wrap(verifyOtp),
  loginWithPassword: wrap(loginWithPassword),

  // Profile
  getProfile: wrap(getProfile),
  updateProfile: wrap(updateProfile),
  changePassword: wrap(changePassword),
  deleteAccount: wrap(deleteAccount),

  // Stories - browse
  getHomeFeed: wrap(getHomeFeed),
  getStoriesByCategory: wrap(getStoriesByCategory),
  getStoryDetails: wrap(getStoryDetails),
  searchStories: wrap(searchStories),

  // My Stories - user's own
  getMyStories: wrap(getMyStories),
  createMyStory: wrap(createMyStory),
  updateMyStory: wrap(updateMyStory),
  deleteMyStory: wrap(deleteMyStory),

  // Favorites
  toggleFavorite: wrap(toggleFavorite),
  getFavorites: wrap(getFavorites),

  // Reading progress
  saveReadingProgress: wrap(saveReadingProgress),
  getReadingHistory: wrap(getReadingHistory),

  // Categories
  getCategories: wrap(getCategories),
  getMorningFlow: wrap(getMorningFlow),
  completeMorning: wrap(completeMorning),
  getEveningFlow: wrap(getEveningFlow),
  completeEvening: wrap(completeEvening),
  getTreasureHunt: wrap(getTreasureHunt),
  submitTreasureHunt: wrap(submitTreasureHunt),

  // Middleware (export for routes)

  //sm practice

  getSmPracticeLabFlow: wrap(getSmPracticeLabFlow),
  submitSmPracticeLab: wrap(submitSmPracticeLab),
  getSmPracticeLabCategories: wrap(getSmPracticeLabCategories),
  getSmPracticeLabPowersForApp: wrap(getSmPracticeLabPowersForApp),
  verifyToken,

  // coin invest
  getCoinInvest: wrap(getCoinInvest),
  submitCoinInvest: wrap(submitCoinInvest),

  // stories new (app)
  getStoriesNewForApp: wrap(getStoriesNewForApp),
  getStoryNewForApp: wrap(getStoryNewForApp),
  submitStoryNew: wrap(submitStoryNew),
  completeStoryNew: wrap(completeStoryNew),
};
