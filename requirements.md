# DomainCal MVP Requirements

Below is a concise set of functional requirements for the DomainCal MVP, based on the provided mockups. The focus is on essential features—no unnecessary frills—ensuring a lean, testable product.

---

## 1. Domain Input & Tracking

1. **Add Multiple Domains at Once**  
   - Users can type or paste multiple domain names (one per line or separated by spaces) into a single text area field.  
   - Clicking “Track” parses and stores each valid domain.
   - If the user is unauthenticated, they are prompted to login/register before the domains are saved to the user's account.

2. **Domain Validation**  
   - The system must validate each domain name for proper formatting (e.g., valid TLD, no invalid characters).  
   - Invalid entries trigger a user-friendly error message (e.g., “Invalid domain: xyz”).

3. **Domain Storage**  
   - Once validated, each domain is saved to the user’s account.  
   - No duplicates per user (i.e., each user cannot track the same domain twice).

---

## 2. User Account Management

1. **Registration**  
   - Users must provide an email and password to create an account.  
   - Passwords are stored securely (e.g., hashed and salted).

2. **Login/Logout**  
   - Returning users can log in with their credentials.  
   - Only the user’s own domains are visible upon login.  
   - A logout option is provided.

3. **Data Persistence**  
   - Tracked domains remain associated with each user.  
   - Upon login, users see all previously added domains.

---

## 3. Domain Display & Management

1. **Dashboard/List View**  
   - Users see a list or “cards” of their tracked domains.  
   - Each entry displays:  
     - Domain name (e.g., `example.com`)  
     - Expiry date (e.g., `22 March 2025`)

2. **Delete Domain**  
   - A “trash” or “delete” icon/button is available for each tracked domain.  
   - Clicking the icon removes the domain from the user’s list (confirmation step required).

3. **Add Domains Link/Button**  
   - A prominent “Add Domains” link/button on the dashboard leads to the domain input form.  
   - If not logged in, the user is prompted to register or log in first.

4. **Calendar Integration**
   - The system provides a way to export the user's domain list to a google calendar or ical file.
   - The user can then view their domains on their calendar and click on the link to be taken to the domain list.

---

## 4. Expiry Date Handling

1. **Automated Retrieval** (If In-Scope)  
   - The system may retrieve domain expiry data automatically via a WHOIS lookup API. Documentation for the whois lookup API is in https://apilayer.com/marketplace/whois-api  

2. **Display Format**  
   - Display expiry dates in a user-friendly format (e.g., `DD Month YYYY`).  
   - Ensure consistency with the mockup style.

---

## 5. Error Handling & User Feedback

1. **Form Feedback**  
   - Display success or error messages for adding, updating, or deleting domains.  
   - Provide meaningful error messages (e.g., “Invalid domain format”).

2. **Security & Validation**  
   - Basic protections against malformed inputs and unauthorized data access.  
   - Users should not be able to access or modify another user’s domain list.

---

## 6. Basic UI/UX Requirements

1. **Responsive Layout**  
   - The layout should adapt to various screen sizes (desktop, tablet, mobile).

2. **Simple, Intuitive Navigation**  
   - Clear calls to action for domain tracking.  
   - Straightforward login/register prompts.

---
