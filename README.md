# Hot Takes - Anonymous Social App

A vanilla JavaScript web application where users can share their "hot takes" (unpopular opinions) anonymously or with attribution. Built with pure HTML, CSS, and JavaScript using Supabase for authentication and database.

## Features

- **User Authentication**: Sign up and sign in with email/password
- **Anonymous Posting**: Share hot takes without revealing your identity
- **Post Management**: Edit and delete your own posts
- **Profile Page**: View and manage all your posts
- **Real-time Updates**: See new posts as they're shared
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend**: Supabase (Authentication & Database)
- **Deployment**: Netlify

## Setup Instructions

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new account
2. Create a new project
3. Wait for the project to be set up (this can take a few minutes)

### 2. Database Setup

Once your project is ready:

1. Go to the SQL Editor in your Supabase dashboard
2. Run this SQL to create the posts table:

```sql
-- Create posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies for posts
CREATE POLICY "Users can view all posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = author_id);
```

### 3. Get Your Supabase Credentials

1. Go to Settings > API in your Supabase dashboard
2. Copy your project URL and anon/public key

### 4. Configure the Application

1. Open `supabase-config.js`
2. Replace the placeholder values with your actual Supabase credentials:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://your-actual-project-id.supabase.co',
    anonKey: 'your-actual-anon-key-here'
};
```

### 5. Local Development

Simply open `index.html` in your web browser. The application will run entirely in the browser with no build process required.

### 6. Deploy to Netlify (Secure Method)

**IMPORTANT: Never commit real Supabase credentials to public repositories!**

#### Option A: Environment Variables (Recommended)
1. Set your Supabase credentials as environment variables in Netlify:
   - Go to your Netlify site dashboard > Site settings > Environment variables
   - Add: `SUPABASE_URL` = `https://your-project-id.supabase.co`
   - Add: `SUPABASE_ANON_KEY` = `your-actual-anon-key`

2. Create a build script to inject the credentials:
   ```javascript
   // build.js (create this file)
   const fs = require('fs');

   const config = `// Supabase Configuration (Generated)
const SUPABASE_CONFIG = {
    url: '${process.env.SUPABASE_URL}',
    anonKey: '${process.env.SUPABASE_ANON_KEY}'
};

const supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);`;

   fs.writeFileSync('supabase-config.js', config);
   ```

3. Deploy to Netlify:
   - Push your code to Git (without supabase-config.js)
   - Go to [netlify.com](https://netlify.com) and sign in
   - Click "Add new site" > "Import an existing project"
   - Set build command: `node build.js`
   - Set publish directory: `.`

#### Option B: Local Configuration (Development Only)
1. Keep `supabase-config.js` out of Git with `.gitignore`
2. Configure credentials locally for development
3. Deploy manually by uploading files directly to Netlify (not via Git)
4. **WARNING: Never push the configured file to public repositories!**

Your site will be live immediately after deployment!

## Usage

1. **Sign Up**: Create a new account with your email and password
2. **Sign In**: Log in to your account
3. **Share Hot Takes**: Write your unpopular opinion and choose whether to post anonymously
4. **View Posts**: See all hot takes from other users
5. **Manage Posts**: Visit your profile to edit or delete your posts

## File Structure

```
/Users/sanjayreddykomatireddy/Downloads/HotorNot/
├── index.html          # Homepage with post feed
├── profile.html        # User profile page
├── auth.html          # Authentication page (if needed)
├── styles.css         # All styling
├── auth.js           # Authentication logic
├── posts.js          # Post management
├── profile.js        # Profile functionality
├── supabase-config.js # Supabase configuration
└── README.md         # This file
```

## Security Features

- **Row Level Security (RLS)**: Users can only edit/delete their own posts
- **Anonymous Posting**: Optional anonymous mode hides user identity
- **Input Validation**: Content is validated and sanitized
- **Session Management**: Secure authentication with Supabase Auth

## Customization

### Styling
Edit `styles.css` to customize the appearance. The design is mobile-responsive and uses modern CSS features.

### Functionality
- Modify `auth.js` for authentication customizations
- Edit `posts.js` to change post behavior
- Update `profile.js` for profile page features

## Troubleshooting

### Common Issues

1. **Posts not loading**: Check that your Supabase credentials are correct and the posts table exists
2. **Authentication not working**: Verify your Supabase project URL and anon key
3. **Anonymous posts showing author**: Check RLS policies in Supabase

### Debug Mode
Open browser developer tools and check the console for error messages.

## License

This project is open source and available under the MIT License.
