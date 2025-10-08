// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Wait for supabase to be available
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase client not loaded yet');
            setTimeout(() => this.init(), 100);
            return;
        }

        // Check for existing session
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            this.currentUser = session.user;
            this.updateUI();
        }

        // Listen for auth changes
        window.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
            this.updateUI();
        });
    }

    async signUp(email, password) {
        try {
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            return { success: true, message: 'Check your email for the confirmation link!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            return { success: true, message: 'Successfully signed in!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async signOut() {
        try {
            const { error } = await window.supabase.auth.signOut();
            if (error) throw error;

            return { success: true, message: 'Successfully signed out!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    updateUI() {
        const heroSection = document.getElementById('hero-section');
        const newsCarousel = document.getElementById('news-carousel');
        const mainContent = document.getElementById('main-content');
        const authBtn = document.getElementById('auth-btn');
        const navMenu = document.querySelector('.nav-menu');
        const createPostSection = document.getElementById('create-post');

        if (this.currentUser) {
            // User is logged in
            if (heroSection) heroSection.style.display = 'none';
            if (newsCarousel) newsCarousel.style.display = 'block';
            if (mainContent) mainContent.style.display = 'block';
            if (authBtn) authBtn.style.display = 'none';
            if (navMenu) navMenu.style.display = 'flex';
            if (createPostSection) createPostSection.style.display = 'block';
        } else {
            // User is not logged in
            if (heroSection) heroSection.style.display = 'flex';
            if (newsCarousel) newsCarousel.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';
            if (authBtn) authBtn.style.display = 'inline';
            if (navMenu) navMenu.style.display = 'none';
            if (createPostSection) createPostSection.style.display = 'none';
        }
    }

    showAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Authentication</h2>
                <div id="auth-forms">
                    <div id="signin-form">
                        <h3>Sign In</h3>
                        <input type="email" id="signin-email" placeholder="Email" required>
                        <input type="password" id="signin-password" placeholder="Password" required>
                        <button id="signin-btn">Sign In</button>
                        <p>Don't have an account? <a href="#" id="show-signup">Sign Up</a></p>
                    </div>
                    <div id="signup-form" style="display: none;">
                        <h3>Sign Up</h3>
                        <input type="email" id="signup-email" placeholder="Email" required>
                        <input type="password" id="signup-password" placeholder="Password" required>
                        <button id="signup-btn">Sign Up</button>
                        <p>Already have an account? <a href="#" id="show-signin">Sign In</a></p>
                    </div>
                </div>
                <div id="auth-message"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => this.hideAuthModal();

        // Sign In functionality
        document.getElementById('signin-btn').onclick = async () => {
            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;

            const result = await this.signIn(email, password);
            this.showMessage(result.message);

            if (result.success) {
                setTimeout(() => this.hideAuthModal(), 1000);
            }
        };

        // Sign Up functionality
        document.getElementById('signup-btn').onclick = async () => {
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            const result = await this.signUp(email, password);
            this.showMessage(result.message);

            if (result.success) {
                setTimeout(() => this.hideAuthModal(), 2000);
            }
        };

        // Toggle between forms
        document.getElementById('show-signup').onclick = (e) => {
            e.preventDefault();
            document.getElementById('signin-form').style.display = 'none';
            document.getElementById('signup-form').style.display = 'block';
        };

        document.getElementById('show-signin').onclick = (e) => {
            e.preventDefault();
            document.getElementById('signup-form').style.display = 'none';
            document.getElementById('signin-form').style.display = 'block';
        };

        modal.style.display = 'block';
    }

    hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.remove();
        }
    }

    showMessage(message) {
        const messageDiv = document.getElementById('auth-message');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';

            setTimeout(() => {
                if (messageDiv) {
                    messageDiv.style.display = 'none';
                }
            }, 3000);
        } else {
            console.warn('Auth message element not found');
        }
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Event listeners for header buttons
const authBtn = document.getElementById('auth-btn');
if (authBtn) {
    authBtn.onclick = () => authManager.showAuthModal();
}

// Event listener for hero CTA button
const heroLoginBtn = document.getElementById('hero-login-btn');
if (heroLoginBtn) {
    heroLoginBtn.onclick = () => authManager.showAuthModal();
}
