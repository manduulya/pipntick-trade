import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — pipntick",
  description: "How pipntick.trade collects, uses, and protects your data, including cookies and third-party services such as Google AdSense.",
  alternates: { canonical: "/privacy" },
};

const CONTACT = "support@pipntick.trade";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 3, 2026">
      <p>
        This Privacy Policy explains how pipntick (&quot;pipntick&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses, and
        protects information when you use the pipntick.trade website and application (the
        &quot;Service&quot;). By using the Service you agree to the practices described here.
      </p>

      <h2>Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>
          <strong>Account information.</strong> When you register, our authentication provider
          (Clerk) collects your name, email address, and a securely hashed password. We do not
          store your raw password.
        </li>
        <li>
          <strong>Trading data.</strong> The trades, notes, screenshots, account balances, broker
          names, and settings you enter into your journal. This content is private to your account.
        </li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage and device data.</strong> Standard server logs and analytics — IP address,
          browser type, pages visited, referring page, and timestamps — used to operate, secure,
          and improve the Service.
        </li>
        <li>
          <strong>Cookies and similar technologies.</strong> See the Cookies section below.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service and its features.</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To calculate the performance analytics, calendars, and reports you request.</li>
        <li>To generate AI-assisted trade analysis when you explicitly request it for a trade.</li>
        <li>To display advertising that helps keep the Service free (see Advertising below).</li>
        <li>To respond to support requests and to detect, prevent, and address abuse or technical issues.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Cookies and similar technologies</h2>
      <p>We and our partners use cookies and similar technologies for:</p>
      <ul>
        <li><strong>Essential cookies</strong> — set by our authentication provider to keep you signed in and to protect against fraud. The Service does not function without these.</li>
        <li><strong>Preference storage</strong> — your theme and date/time format are stored in your browser&apos;s local storage.</li>
        <li>
          <strong>Advertising cookies</strong> — set by Google and its partners to serve and measure
          ads (see below).
        </li>
      </ul>

      <h2>Advertising</h2>
      <p>
        We use <strong>Google AdSense</strong> to display advertisements. Third-party vendors,
        including Google, use cookies to serve ads based on your prior visits to this and other
        websites.
      </p>
      <ul>
        <li>
          Google&apos;s use of advertising cookies enables it and its partners to serve ads to you
          based on your visit to this Service and/or other sites on the Internet.
        </li>
        <li>
          You may opt out of personalised advertising by visiting{" "}
          <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
        </li>
        <li>
          You can opt out of a third-party vendor&apos;s use of cookies for personalised advertising
          at{" "}
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">aboutads.info</a>.
        </li>
        <li>
          More information is available in{" "}
          <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">Google&apos;s Advertising policies</a>.
        </li>
      </ul>

      <h2>Third-party services</h2>
      <p>We rely on the following processors to run the Service. Each handles data only as needed to provide their function:</p>
      <ul>
        <li><strong>Clerk</strong> — user authentication and account management.</li>
        <li><strong>Railway</strong> — application hosting and managed database.</li>
        <li><strong>Google AdSense</strong> — advertising.</li>
        <li><strong>Anthropic</strong> — processing the specific trade you submit for AI analysis, only when you request it.</li>
        <li>Market data and economic-calendar providers for the news and quote features.</li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your account and trading data for as long as your account is active. When you delete
        your account, your trades, accounts, and profile are permanently removed from our database.
        Backups and provider logs may persist for a limited period before being overwritten.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access and correction.</strong> You can view and edit your account details and trading data at any time from within the app.</li>
        <li><strong>Deletion.</strong> You can delete your account from Settings, which erases your data as described above.</li>
        <li><strong>Ad personalisation.</strong> You can control ad personalisation using the links in the Advertising section.</li>
      </ul>
      <p>
        If you are in a jurisdiction with additional data-protection rights (such as the EEA, UK, or
        California), you may also have the right to object to or restrict processing and to lodge a
        complaint with your local supervisory authority. Contact us to exercise these rights.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be reflected by the
        &quot;Last updated&quot; date above and, where appropriate, an in-app notice.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </LegalPage>
  );
}
