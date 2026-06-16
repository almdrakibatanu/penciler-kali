import type { Metadata } from 'next';
import { Ads } from '@/components/Ads';

export const metadata: Metadata = {
  title: 'Terms of Use & Disclaimer — PencilerKali.com',
  description: 'The terms governing your use of PencilerKali.com, including content accuracy disclaimers, intellectual property, third-party links, and limitation of liability.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-2">Terms of Use &amp; Disclaimer</h1>
      <p className="text-sm text-ink-500">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <p>Welcome to PencilerKali.com. By accessing or using this website, you agree to these Terms of Use. If you do not agree, please do not use the site.</p>

      <h2>Use of the site</h2>
      <p>PencilerKali.com provides Bangla-language news and information for general, informational purposes. You agree to use the site lawfully and not to misuse, disrupt, scrape at scale, or attempt to gain unauthorised access to it or its systems.</p>

      <h2>Accuracy &amp; news disclaimer</h2>
      <p>We work to publish accurate, well-sourced information and to correct errors promptly. However, news develops quickly and content is provided "as is", without warranties of any kind as to accuracy, completeness, or timeliness. Nothing on this site constitutes legal, financial, medical, or professional advice. Always verify critical information with official or primary sources before acting on it.</p>

      <h2>Intellectual property &amp; sourcing</h2>
      <p>Articles on PencilerKali.com are written in original Bangla and credit the sources they draw on; every article links to its original sources. Trademarks, logos, and source material referenced remain the property of their respective owners and are used for reporting and commentary. You may share links to our articles freely, but you may not republish our content in bulk without permission.</p>

      <h2>Third-party links &amp; advertising</h2>
      <p>The site links to third-party websites (including our cited sources) and displays third-party advertising. We do not control and are not responsible for the content, accuracy, or practices of third-party sites or advertisers. Visiting them is at your own risk and subject to their own terms and policies.</p>

      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, PencilerKali.com and its operators are not liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the site or any content on it.</p>

      <h2>Corrections &amp; takedowns</h2>
      <p>If you believe content is inaccurate, infringes your rights, or should be removed, contact us with the article URL and details through our <a href="/contact">Contact</a> page. See our <a href="/editorial-policy">Editorial Policy</a> for how we handle corrections.</p>

      <h2>Changes to these terms</h2>
      <p>We may update these Terms from time to time. The "last updated" date above reflects the latest revision, and continued use of the site after changes constitutes acceptance of the updated Terms.</p>

      <h2>Governing law</h2>
      <p>These Terms are governed by the laws of the People's Republic of Bangladesh.</p>

      <h2>Contact</h2>
      <p>Questions about these Terms? Reach us via the <a href="/contact">Contact</a> page.</p>

      <Ads />
    </div>
  );
}
