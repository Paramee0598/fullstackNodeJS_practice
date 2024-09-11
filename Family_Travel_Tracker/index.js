import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "24032544",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1 ;
let users = [{}] ;

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1;",[currentUserId]);
  let countries = []; 
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;

}



async function getCurrentUser() { //get data from Current User
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  console.log(users);
  let curr_usr = users.find((user)=> user.id === currentUserId);
  console.log(curr_usr);
  return  curr_usr ;

  ;
  
}
app.get("/", async (req, res) => {
  
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();
  //console.log(users);
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  //const currentUser = await getCurrentUser();
    try {
      if (input.length <= 2) {
        res.redirect("/");
        throw new Error("minimum 3 string.");
        
      }
      const result = await db.query(
        "SELECT country_code FROM countries WHERE country_name iLIKE '%' || $1 || '%' LIMIT 1;",
        [input]
      );
      if (result.rows.length === 0) {
        res.redirect("/");
        throw new Error("No country found");
    }
      console.log(result);

  
      const data = result.rows[0];
      const countryCode = data.country_code;
      try {
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1,$2)",
          [countryCode,currentUserId]
        );
        res.redirect("/");
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log(err);
    }
    
   
 
});
app.post("/user", async (req, res) => {

  if (req.body.add === "new") {   //  <input type="submit" name="add" value="new" id="tab">
  res.render("new.ejs");         // <label for="tab">Add Family Member</label>

} else{
  currentUserId = parseInt(req.body.user);
  //console.log(typeof currentUserId );
  res.redirect("/");
}

});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;
  const add_result = await db.query(
"INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",[name, color]
    
  );
  const id_new = add_result.rows[0].id
  currentUserId = id_new;

  res.redirect("/");


  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
