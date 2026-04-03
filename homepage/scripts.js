// DOM Elements
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const header = document.querySelector('.header');
const contactForm = document.getElementById('contactForm');

// Navigation functionality
function initNavigation() {
    if (!navToggle || !navMenu) return;

    navToggle.addEventListener('click', toggleMobileMenu);

    // Close mobile menu when clicking on nav links
    navLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
            closeMobileMenu();
        }
    });

    // Handle keyboard navigation
    navToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMobileMenu();
        }
    });
}

function toggleMobileMenu() {
    const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';

    navToggle.setAttribute('aria-expanded', !isExpanded);
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');

    // Prevent body scroll when menu is open
    document.body.style.overflow = isExpanded ? 'auto' : 'hidden';
}

function closeMobileMenu() {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('active');
    navMenu.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Header scroll effect
function initHeaderScroll() {
    if (!header) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Add scrolled class when scrolling down
        if (currentScrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScrollY = currentScrollY;
    });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.offsetTop - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                closeMobileMenu();
            }
        });
    });
}

// Form validation and submission
function initContactForm() {
    if (!contactForm) return;

    const formFields = {
        name: contactForm.querySelector('#name'),
        email: contactForm.querySelector('#email'),
        subject: contactForm.querySelector('#subject'),
        message: contactForm.querySelector('#message')
    };

    const errorElements = {
        name: contactForm.querySelector('#name-error'),
        email: contactForm.querySelector('#email-error'),
        subject: contactForm.querySelector('#subject-error'),
        message: contactForm.querySelector('#message-error')
    };

    const successMessage = contactForm.querySelector('#success-message');

    // Real-time validation
    Object.keys(formFields).forEach(fieldName => {
        const field = formFields[fieldName];
        if (field) {
            field.addEventListener('blur', () => validateField(fieldName, field, errorElements[fieldName]));
            field.addEventListener('input', () => clearFieldError(fieldName, field, errorElements[fieldName]));
        }
    });

    // Form submission
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (validateForm()) {
            await submitForm();
        }
    });

    function validateField(fieldName, field, errorElement) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = `${getFieldLabel(fieldName)} is required.`;
        }

        // Email validation
        if (fieldName === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address.';
            }
        }

        // Name validation
        if (fieldName === 'name' && value && value.length < 2) {
            isValid = false;
            errorMessage = 'Name must be at least 2 characters long.';
        }

        // Message validation
        if (fieldName === 'message' && value && value.length < 10) {
            isValid = false;
            errorMessage = 'Message must be at least 10 characters long.';
        }

        updateFieldError(field, errorElement, isValid, errorMessage);
        return isValid;
    }

    function clearFieldError(fieldName, field, errorElement) {
        if (field.value.trim()) {
            updateFieldError(field, errorElement, true, '');
        }
    }

    function updateFieldError(field, errorElement, isValid, errorMessage) {
        const formGroup = field.closest('.form-group');

        if (isValid) {
            formGroup.classList.remove('error');
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }
            field.setAttribute('aria-invalid', 'false');
        } else {
            formGroup.classList.add('error');
            if (errorElement) {
                errorElement.textContent = errorMessage;
                errorElement.style.display = 'block';
            }
            field.setAttribute('aria-invalid', 'true');
        }
    }

    function validateForm() {
        let isFormValid = true;

        // Validate required fields
        ['name', 'email', 'message'].forEach(fieldName => {
            const field = formFields[fieldName];
            const errorElement = errorElements[fieldName];

            if (field && !validateField(fieldName, field, errorElement)) {
                isFormValid = false;
            }
        });

        return isFormValid;
    }

    async function submitForm() {
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;

        // Show loading state
        submitButton.innerHTML = 'Sending... <span>⏳</span>';
        submitButton.disabled = true;

        try {
            // Simulate API call (replace with actual endpoint)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Show success message
            if (successMessage) {
                successMessage.style.display = 'block';
                successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Reset form
            contactForm.reset();

            // Clear any existing errors
            Object.keys(formFields).forEach(fieldName => {
                const field = formFields[fieldName];
                const errorElement = errorElements[fieldName];
                if (field && errorElement) {
                    updateFieldError(field, errorElement, true, '');
                }
            });

            // Hide success message after 5 seconds
            if (successMessage) {
                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000);
            }

        } catch (error) {
            console.error('Form submission error:', error);
            alert('Sorry, there was an error sending your message. Please try again or contact us directly.');
        } finally {
            // Restore button state
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }

    function getFieldLabel(fieldName) {
        const labels = {
            name: 'Name',
            email: 'Email',
            subject: 'Subject',
            message: 'Message'
        };
        return labels[fieldName] || fieldName;
    }
}

// =============================================
// INTERACTIVE ANIMATIONS & HOVER EFFECTS
// =============================================

// Feature Cards Hover Effects
function initFeatureCardAnimations() {
    const featureCards = document.querySelectorAll('.feature-card');

    featureCards.forEach((card, index) => {
        card.style.setProperty('--card-index', index);

        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-12px) scale(1.02)';
            this.style.boxShadow = '0 20px 40px rgba(184, 134, 11, 0.2)';
            
            

            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '#b8860b';
            }
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '';
            
            

            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '';
            }
        });

    });
}

// Step Cards Animation (Same as Feature Cards - Lift & Scale)
function initStepCardAnimations() {
    const stepCards = document.querySelectorAll('.step-card');

    stepCards.forEach((card, index) => {
        card.style.setProperty('--step-index', index);

        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-12px) scale(1.02)';
            this.style.boxShadow = '0 20px 40px rgba(184, 134, 11, 0.2)';
            
            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '#b8860b';
            }

            const stepNumber = this.querySelector('.step-number');
            if (stepNumber) {
                stepNumber.style.color = '#b8860b';
            }
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '';

            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '';
            }

            const stepNumber = this.querySelector('.step-number');
            if (stepNumber) {
                stepNumber.style.color = '';
            }
        });

        
    });
}

// Testimonial Cards Hover Effects
function initTestimonialAnimations() {
    const testimonials = document.querySelectorAll('.testimonial-card');

    testimonials.forEach((card, index) => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-16px) rotateX(2deg)';
            this.style.boxShadow = '0 25px 50px rgba(184, 134, 11, 0.25)';

            const stars = this.querySelectorAll('.stars svg');
            stars.forEach((star, i) => {
                star.style.animation = `starPulse 0.6s ease ${i * 0.1}s`;
            });

            const quote = this.querySelector('blockquote');
            if (quote) {
                quote.style.transform = 'scale(1.02)';
                quote.style.color = '#1a1a1a';
            }

            const authorName = this.querySelector('.author-name');
            if (authorName) {
                authorName.style.color = '#b8860b';
                authorName.style.fontWeight = '600';
            }
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) rotateX(0deg)';
            this.style.boxShadow = '';

            const stars = this.querySelectorAll('.stars svg');
            stars.forEach((star) => {
                star.style.animation = 'none';
            });

            const quote = this.querySelector('blockquote');
            if (quote) {
                quote.style.transform = 'scale(1)';
                quote.style.color = '';
            }

            const authorName = this.querySelector('.author-name');
            if (authorName) {
                authorName.style.color = '';
                authorName.style.fontWeight = '';
            }
        });

        card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
}

// About Values Cards Animation
function initValueCardsAnimations() {
    const valueCards = document.querySelectorAll('.value-card');

    valueCards.forEach((card, index) => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.boxShadow = '0 15px 35px rgba(184, 134, 11, 0.2)';

            const icon = this.querySelector('svg');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(5deg)';
                icon.style.stroke = '#b8860b';
                icon.style.fill = 'rgba(184, 134, 11, 0.1)';
            }

            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '#b8860b';
                title.style.transform = 'translateY(-2px)';
            }

            const text = this.querySelector('p');
            if (text) {
                text.style.color = '#1a1a1a';
                text.style.fontWeight = '500';
            }

            if (this.classList.contains('featured')) {
                this.style.background = 'linear-gradient(135deg, rgba(184, 134, 11, 0.08) 0%, rgba(184, 134, 11, 0.04) 100%)';
            }
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '';

            const icon = this.querySelector('svg');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
                icon.style.stroke = '';
                icon.style.fill = '';
            }

            const title = this.querySelector('h3');
            if (title) {
                title.style.color = '';
                title.style.transform = 'translateY(0)';
            }

            const text = this.querySelector('p');
            if (text) {
                text.style.color = '';
                text.style.fontWeight = '';
            }

            if (this.classList.contains('featured')) {
                this.style.background = '';
            }
        });

        card.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        const icon = card.querySelector('svg');
        if (icon) {
            icon.style.transition = 'all 0.3s ease';
        }
        const title = card.querySelector('h3');
        if (title) {
            title.style.transition = 'all 0.3s ease';
        }
    });
}

// Intersection Observer for animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.feature-card, .testimonial-card, .value-card, .step-card');
    animatedElements.forEach((el, index) => {
        if (window.getComputedStyle(el).opacity !== '1') {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
            observer.observe(el);
        }
    });
}

// Button Hover Effects
function initButtonAnimations() {
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-secondary-dark');

    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 8px 16px rgba(184, 134, 11, 0.3)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '';
        });

        button.style.transition = 'all 0.2s ease';
    });
}

// Add star pulse animation keyframes
function injectAnimationKeyframes() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes starPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2) rotate(10deg); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

// Utility functions
function openChat() {
    // Placeholder for chat functionality
    alert('Chat feature coming soon! Please use the contact form or email us directly.');
}

// Performance optimization
function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.remove('loading');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => {
            img.classList.add('loading');
            imageObserver.observe(img);
        });
    }
}

// Error handling
window.addEventListener('error', (e) => {
    console.error('JavaScript error:', e.error);
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Inject animation keyframes first
    injectAnimationKeyframes();

    // Core functionality
    initNavigation();
    initHeaderScroll();
    initSmoothScrolling();
    initContactForm();
    initLazyLoading();

    // Interactive animations
    initScrollAnimations();
    initFeatureCardAnimations();
    initStepCardAnimations();
    initTestimonialAnimations();
    initValueCardsAnimations();
    initButtonAnimations();
});

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Close mobile menu on resize to desktop
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    }, 250);
});

// Keyboard accessibility
document.addEventListener('keydown', (e) => {
    // Close mobile menu with Escape key
    if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
        closeMobileMenu();
    }
});

// Expose functions globally for inline event handlers
window.openChat = openChat;
