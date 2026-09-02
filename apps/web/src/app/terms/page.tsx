import type { Metadata } from "next";
import LegalPage from "../_components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — pipntick",
  description: "The terms that govern your use of the pipntick.trade trading journal and analytics service.",
  alternates: { canonical: "/terms" },
};

const CONTACT = "support@pipntick.trade";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="September 3, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the pipntick.trade
        website and application (the &quot;Service&quot;), operated by pipntick (&quot;we&quot;, &quot;us&quot;). By
        creating an account or using the Service, you agree to these Terms. If you do not agree, do
        not use the Service.
      </p>

      <h2>The Service</h2>
      <p>
        pipntick is a trading journal and performance-analytics tool. It lets you record your
        trades, view them on a calendar, analyse your results over time, and optionally request
        AI-assisted analysis of individual trades. The Service is currently offered in early access
        and is provided free of charge; features may change, be added, or be removed.
      </p>

      <h2>Not financial advice</h2>
      <p>
        <strong>
          pipntick is a record-keeping and analytics tool only. Nothing in the Service is financial,
          investment, tax, or legal advice, and nothing is a recommendation to buy, sell, or hold
          any instrument.
        </strong>{" "}
        Analytics, charts, session labels, and AI-generated commentary are informational,
        may contain errors, and must not be relied upon for trading decisions. Trading carries a
        high risk of loss. You are solely responsible for your own trading activity and its
        outcomes.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old to use the Service.</li>
        <li>You are responsible for the accuracy of the data you enter and for keeping your login credentials secure.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>Notify us promptly of any unauthorised use of your account.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Access the Service by any means other than the interface we provide, or attempt to disrupt, overload, or reverse-engineer it.</li>
        <li>Upload malware, attempt to gain unauthorised access to other accounts or our systems, or scrape the Service.</li>
        <li>Use the Service to store or transmit unlawful, infringing, or abusive content.</li>
        <li>Resell or commercially redistribute the Service without our written permission.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the trades, notes, and files you upload (&quot;Your Content&quot;). You
        grant us a limited licence to store, process, and display Your Content solely to operate the
        Service for you. We do not claim ownership of Your Content and do not sell it.
      </p>

      <h2>Advertising</h2>
      <p>
        The Service displays third-party advertising (Google AdSense) to remain free to use. We are
        not responsible for the content of ads or for the products or services they promote. Your
        interactions with advertisers are solely between you and the advertiser.
      </p>

      <h2>Third-party services and data</h2>
      <p>
        The Service integrates third-party providers for authentication, hosting, advertising, AI
        analysis, and market data. Market prices, news, and economic-calendar data are provided
        &quot;as is&quot; and may be delayed or inaccurate.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We aim to keep the Service available but do not guarantee uninterrupted access. We may
        modify, suspend, or discontinue any part of the Service at any time. We may also update
        these Terms; continued use after changes take effect constitutes acceptance.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time from Settings. We may
        suspend or terminate your access if you breach these Terms or use the Service in a way that
        could cause harm or legal liability.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
        express or implied, including fitness for a particular purpose and non-infringement. To the
        maximum extent permitted by law, we will not be liable for any indirect, incidental,
        special, or consequential damages, or for any trading losses, lost profits, or loss of data
        arising from your use of the Service.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws applicable at our principal place of business, without
        regard to conflict-of-laws rules. Disputes will be resolved in the courts of that
        jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </LegalPage>
  );
}
