// 1. Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');

// 2. Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// --- Application State ---
// This will keep track of which number to redirect to next.
let currentNumberIndex = 0;

// 3. Configure Middleware
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session Configuration
app.use(session({
    secret: 'a-very-secret-key-for-whatsapp-redirect', // Change this in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to check if the user is authenticated
const requireLogin = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

// 4. Connect to MongoDB
mongoose.connect('mongodb+srv://techneural:XB1ajIgz32TAK8Uw@techneural.rcfn1ld.mongodb.net/ganamous-net', { // Using a new DB
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Successfully connected to MongoDB!'))
  .catch(err => { console.error('Connection error', err); process.exit(); });

// 5. Define Mongoose Schema and Model
const numberSchema = new mongoose.Schema({
    countryCode: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    customMessage: { type: String, default: 'Hello' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});
const PhoneNumber = mongoose.model('PhoneNumber', numberSchema);

// --- 6. Routes ---

// --- Authentication Routes ---
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // In a real app, you would look up the user in the DB and check a hashed password.
    // For this example, we'll use hardcoded credentials.
    if (username === 'admin' && password === 'password') {
        req.session.userId = 'admin_user_id'; // Set a session user ID
        res.redirect('/'); // Redirect to the main add number page after login
    } else {
        res.render('login', { error: 'Invalid username or password.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});


// --- Main Application Routes (Protected) ---

// The new home page to add numbers
app.get('/', (req, res) => {
    res.render('index');
});

// The success page shown after adding a number
app.get('/success', (req, res) => {
    const phoneNumber = req.query.phoneNumber;
    res.render('success', { phoneNumber });
});

// Handles the form submission from the home page
app.post('/add-number', async (req, res) => {
    try {
        const { countryCode, phoneNumber, customMessage } = req.body;
        const newNumber = new PhoneNumber({
            countryCode: countryCode.replace(/\D/g, ''),
            phoneNumber: phoneNumber.replace(/\D/g, ''),
            customMessage: customMessage || 'Hello' // Add a default message if empty
        });
        await newNumber.save();
        res.redirect(`/success?phoneNumber=${encodeURIComponent(phoneNumber.replace(/\D/g, ''))}`); // Pass phone number to success page as query param
    } catch (error) {
        console.error('Error saving number:', error);
        res.status(500).send('Error saving number.');
    }
});


// --- Dashboard & CRUD Routes (Protected) ---
app.get('/dashboard', requireLogin, async (req, res) => {
    try {
        const numbers = await PhoneNumber.find({}).sort({ createdAt: -1 });
        const redirectURL = `${req.protocol}://${req.get('host')}/redirect`;
        res.render('dashboard', { numbers, redirectURL });
    } catch (error) {
        res.status(500).send('Error fetching data.');
    }
});

app.post('/delete-number/:id', requireLogin, async (req, res) => {
    try {
        await PhoneNumber.findByIdAndDelete(req.params.id);
        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send('Error deleting number.');
    }
});

app.post('/toggle-status/:id', requireLogin, async (req, res) => {
    try {
        const number = await PhoneNumber.findById(req.params.id);
        if (number) {
            number.status = number.status === 'active' ? 'inactive' : 'active';
            await number.save();
        }
        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).send('Error updating status.');
    }
});

// --- Public Redirect Route ---
app.get('/redirect', async (req, res) => {
    try {
        const activeNumbers = await PhoneNumber.find({ status: 'active' });

        if (activeNumbers.length === 0) {
            return res.status(404).send('No active numbers available for redirection.');
        }

        // Rotate to the next number
        if (currentNumberIndex >= activeNumbers.length) {
            currentNumberIndex = 0; // Reset if index is out of bounds
        }
        
        const numberToRedirect = activeNumbers[currentNumberIndex];

        // Increment index for the next request
        currentNumberIndex = (currentNumberIndex + 1) % activeNumbers.length;

        const fullPhoneNumber = `${numberToRedirect.countryCode}${numberToRedirect.phoneNumber}`;
        const message = encodeURIComponent(numberToRedirect.customMessage);
        const whatsappURL = `https://wa.me/${fullPhoneNumber}?text=${message}`;

        res.redirect(whatsappURL);

    } catch (error) {
        res.status(500).send('An error occurred during redirection.');
    }
});


// 7. Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

