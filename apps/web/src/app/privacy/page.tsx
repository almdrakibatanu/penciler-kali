import type { Metadata } from 'next';
import { Ads } from '@/components/Ads';

export const metadata: Metadata = {
  title: 'Privacy Policy — PencilerKali.com',
  description: 'How PencilerKali.com collects, uses, and protects your information, including cookies and Google AdSense disclosures.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-2">Privacy Policy</h1>
      <p className="text-sm text-ink-500">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <p>This Privacy Policy describes how PencilerKali.com ("we", "us", "our") collects, uses, and shares information about visitors ("you") when you use our website and services. By using PencilerKali.com you agree to the practices described below.</p>

      <h2>Information we collect</h2>
      <p>We collect only the minimum information required to operate the site and improve our service. This includes:</p>
      <ul>
        <li><strong>Log data:</strong> IP address, browser type, device type, referring URL, pages visited, and timestamps.</li>
        <li><strong>Cookies and similar technologies:</strong> small data files stored on your device to remember preferences and to support analytics and advertising partners.</li>
        <li><strong>Information you provide:</strong> if you contact us, you may share your name, email, and message content.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To operate, maintain, and improve PencilerKali.com.</li>
        <li>To understand which content and features readers value.</li>
        <li>To prevent abuse, fraud, and security incidents.</li>
        <li>To deliver and measure advertising on our site.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We use first-party cookies for site preferences and third-party cookies from advertising and analytics providers. You can control cookies through your browser settings; disabling cookies may affect some site features.</p>

      <h2>Third-party advertising</h2>
      <p>We may participate in advertising programs, including Google AdSense. Google and its partners may use cookies (including the DoubleClick DART cookie) to serve ads based on your prior visits to this site and other sites on the Internet. You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google Ads Settings</a>. For more information about how third-party vendors use cookies for advertising, visit <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>.</p>

      <h2>Analytics</h2>
      <p>We may use analytics services such as Google Analytics to understand site usage. These services may set cookies and collect information about your visits in an anonymised, aggregated form.</p>

      <h2>Children's privacy</h2>
      <p>PencilerKali.com is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us so we can delete it.</p>

      <h2>Data retention</h2>
      <p>We retain log data and analytics information for as long as it is needed to support the purposes described in this policy. Contact-form messages are retained for as long as necessary to respond and for legitimate record-keeping.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Manage cookies via your browser or device.</li>
        <li>Opt out of personalised ads via <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google Ads Settings</a> or <a href="https://www.aboutads.info" target="_blank" rel="noopener">aboutads.info</a>.</li>
        <li>Request access to or deletion of your contact-form data by emailing us.</li>
      </ul>

      <h2>Changes to this policy</h2>
      <p>We may update this Privacy Policy from time to time. We will indicate the date of the latest revision at the top of this page. Continued use of the site after changes constitutes acceptance of the updated policy.</p>

      <h2>Contact</h2>
      <p>If you have any questions about this Privacy Policy, please reach us through the <a href="/contact">Contact</a> page.</p>
      <Ads />
    </div>
  );
}
