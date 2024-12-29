const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const multer = require("multer"); // Import multer
const path = require("path"); // To handle file paths

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/images", express.static(path.join(__dirname, "public", "images")));


const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  port: 3307,
  password: "",
  database: "vacation tagging system"
});

conn.connect(err => {
  if (err) {
    console.log(err);
  } else {
    console.log("Connected to MySQL");
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/");  // תיקיית התמונות
  },
  filename: (req, file, cb) => {
    // יצירת שם קובץ ייחודי עם תאריך ושם הקובץ המקורי
    const uniqueSuffix = Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));  // שם ייחודי + סיומת
  }
});

const upload = multer({ storage: storage });

// Route to upload an image
app.post("/api/vacations", upload.single("image"), (req, res) => {

  console.log("file name ??", req.file.filename); // Check the uploaded file name

  const { destination, description, start_date, end_date, price } = req.body;
  const imgName = req.file ? req.file.filename : null;  // שם הקובץ שנשמר

  if (!imgName) {
    return res.status(400).send({ message: "No image file uploaded." });
  }

  const sql = "INSERT INTO vacation (vacation_destination, vacation_Description, vacation_start_date, vacation_end_date, price, img_name) VALUES (?, ?, ?, ?, ?, ?)";

  conn.query(sql, [destination, description, start_date, end_date, price, imgName], (err, result) => {
    if (err) {
      console.error("Error adding vacation:", err);
      return res.status(500).send({ message: "Error adding vacation." });
    }
    res.status(200).send({ message: "Vacation added successfully!" });
  });
});





app.get("/api/users/", (req, res) => {
  const sql = "SELECT * FROM `users`;";

  conn.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      res.send(result);
    }
  });
});
app.get("/api/vacations", (req, res) => {
  const page = parseInt(req.query.page) || 1; 
  const limit = parseInt(req.query.limit) || 10;  
  const userId = req.query.userId;  
  const filterLiked = req.query.filterLiked === 'true';  
  const offset = (page - 1) * limit;

  let sql = "SELECT * FROM vacation";

  if (filterLiked && userId) {
    sql = `
        SELECT vacation.* FROM vacation
        JOIN followers ON vacation.ID = followers.vacation_id
        WHERE followers.users_id = ?
        ORDER BY vacation.vacation_start_date ASC
        LIMIT ? OFFSET ?`;
  } else {
    sql += " ORDER BY vacation_start_date ASC LIMIT ? OFFSET ?";
  }

  conn.query(sql, filterLiked && userId ? [userId, limit, offset] : [limit, offset], (err, result) => {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      conn.query("SELECT COUNT(*) AS total FROM vacation", (countErr, countResult) => {
        if (countErr) {
          res.send(countErr);
        } else {
          res.send({
            vacations: result,
            totalVacations: countResult[0].total 
          });
        }
      });
    }
  });
});


app.post("/api/check-email", (req, res) => {
  const email = req.body.email; 
  const sql = "SELECT * FROM users WHERE email = ?"; 
  conn.query(sql, [email], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.length > 0) {
        res.status(400).send({ message: "Email already exists." });
      } else {
        res.status(200).send({ message: "Email is available." });
      }
    }
  });
});


app.post("/api/signup", (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  const sql = "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)";  // שימוש ב-?

  conn.query(sql, [firstName, lastName, email, password], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      res.status(200).send({ message: "User created successfully!" });
    }
  });
});

app.post("/api/signin", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  conn.query(sql, [email, password], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.length > 0) {
        res.status(200).send(result[0]);
      } else {
        res.status(400).send({ message: "Invalid email or password." });
      }
    }
  });
});
app.get("/api/vacations/:id/liked", (req, res) => {
  const vacationId = req.params.id;
  const userId = req.query.userId;  

  const countLikesQuery = "SELECT COUNT(*) AS like_count FROM followers WHERE vacation_id = ?";
  conn.query(countLikesQuery, [vacationId], (err, countResult) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      const checkLikeQuery = "SELECT * FROM followers WHERE users_id = ? AND vacation_id = ?";
      conn.query(checkLikeQuery, [userId, vacationId], (err, result) => {
        if (err) {
          console.log(err);
          res.status(500).send("Database error");
        } else {
          res.status(200).send({ like_count: countResult[0].like_count, liked: result.length > 0 });
        }
      });
    }
  });
});

app.post("/api/vacations/:id/like", (req, res) => {
  const userId = req.body.userId;
  const vacationId = req.params.id;
  const checkLikeQuery = "SELECT * FROM followers WHERE users_id = ? AND vacation_id = ?";
  conn.query(checkLikeQuery, [userId, vacationId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.length > 0) {
        const deleteQuery = "DELETE FROM followers WHERE users_id = ? AND vacation_id = ?";
        conn.query(deleteQuery, [userId, vacationId], (err) => {
          if (err) {
            console.log(err);
            res.status(500).send("Database error");
          } else {
            const countLikesQuery = "SELECT COUNT(*) AS like_count FROM followers WHERE vacation_id = ?";
            conn.query(countLikesQuery, [vacationId], (err, countResult) => {
              if (err) {
                console.log(err);
                res.status(500).send("Database error");
              } else {
                res.status(200).send({ message: "Unliked vacation", likeCount: countResult[0].like_count });
              }
            });
          }
        });
      } else {
        const insertQuery = "INSERT INTO followers (users_id, vacation_id) VALUES (?, ?)";
        conn.query(insertQuery, [userId, vacationId], (err) => {
          if (err) {
            console.log(err);
            res.status(500).send("Database error");
          } else {
            const countLikesQuery = "SELECT COUNT(*) AS like_count FROM followers WHERE vacation_id = ?";
            conn.query(countLikesQuery, [vacationId], (err, countResult) => {
              if (err) {
                console.log(err);
                res.status(500).send("Database error");
              } else {
                res.status(200).send({ message: "Liked vacation", likeCount: countResult[0].like_count });
              }
            });
          }
        });
      }
    }
  });
});


app.delete("/api/vacations/:id", (req, res) => {
  const vacationId = req.params.id;

  const sql = "DELETE FROM vacation WHERE ID = ?";

  conn.query(sql, [vacationId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.affectedRows > 0) {
        res.status(200).send({ message: "Vacation deleted successfully!" });
      } else {
        res.status(404).send({ message: "Vacation not found" });
      }
    }
  });
});

app.post("/api/vacations", (req, res) => {

  const { destination, description, start_date, end_date, price, img_name } = req.body;

  if (!destination || !description || !start_date || !end_date || !price || !img_name) {
    return res.status(400).send({ message: "All fields are required." });
  }

  const sql = "INSERT INTO vacation (vacation_destination, vacation_Description, vacation_start_date, vacation_end_date, price, img_name) VALUES (?, ?, ?, ?, ?, ?)";

  conn.query(sql, [destination, description, start_date, end_date, price, img_name], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send({ message: "Failed to add vacation." });
    } else {
      res.status(200).send({ message: "Vacation added successfully!" });
    }
  });
});

app.get("/api/vacations/:id", (req, res) => {
  const vacationId = req.params.id;
  const sql = "SELECT * FROM vacation WHERE ID = ?";

  conn.query(sql, [vacationId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.length > 0) {
        res.status(200).send(result[0]);
      } else {
        res.status(404).send({ message: "Vacation not found" });
      }
    }
  });
});

app.put("/api/vacations/:id", upload.single("image"), (req, res) => {
  const vacationId = req.params.id;
  const { vacation_destination, vacation_Description, vacation_start_date, vacation_end_date, price } = req.body;
  let imgName = req.body.img_name;

  if (req.file) {
    imgName = req.file.filename;
  }

  const sql = `
        UPDATE vacation
        SET vacation_destination = ?, vacation_Description = ?, vacation_start_date = ?, vacation_end_date = ?, price = ?, img_name = ?
        WHERE ID = ?
      `;

  conn.query(sql, [vacation_destination, vacation_Description, vacation_start_date, vacation_end_date, price, imgName, vacationId], (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      if (result.affectedRows > 0) {
        res.status(200).send({ message: "Vacation updated successfully!" });
      } else {
        res.status(404).send({ message: "Vacation not found" });
      }
    }
  });
});

app.get("/api/chart", (req, res) => {
  const sql = `
          SELECT vacation.vacation_destination, 
                 COUNT(followers.vacation_id) AS like_count
          FROM vacation
          LEFT JOIN followers ON vacation.ID = followers.vacation_id
          GROUP BY vacation.vacation_destination
          ORDER BY vacation.vacation_destination ASC;
      `;

  conn.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).send("Database error");
    } else {
      res.status(200).send({ vacations: result });
    }
  });
});

app.listen(3030, () => {
  console.log("Listening to 3030");
});