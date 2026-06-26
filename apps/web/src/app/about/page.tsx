import type { Metadata } from 'next';
import { Ads } from '@/components/Ads';

export const metadata: Metadata = {
  title: 'About Us — PencilerKali.com',
  description: 'About PencilerKali.com — an independent Bangla news platform covering Bangladesh, international affairs, sports, entertainment and Islamic topics, updated 24/7.',
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-4">About PencilerKali.com</h1>

      <p>PencilerKali.com is an independent Bangla news platform serving readers in Bangladesh and the global Bangladeshi diaspora. Our mission is to give every Bangla-speaking reader fast, accurate, well-written news on the topics that matter to their daily life — coverage of Bangladesh, international affairs, sports, entertainment, and Islamic content — without paywalls and without political agitation.</p>

      <h2>Our editorial approach</h2>
      <p>Every story published on PencilerKali.com is compiled from multiple reputable news sources and rewritten in original Bangla, then checked against those sources before going live. We follow a strict editorial policy: no plagiarism, no hate speech, no incitement, no unverified personal allegations. For political topics, every claim is validated before publication; otherwise the story is held for review.</p>

      <h2>How we work</h2>
      <p>We monitor publicly available news from reputable news sources, official press releases, and verified public statements. Each story is rewritten in clean, original Bangla and checked against the original reporting.</p>

      <h2>Coverage areas</h2>
      <ul>
        <li><strong>Bangladesh:</strong> positive national news, development, environment, wildlife, and incident reporting in a factual, non-graphic style.</li>
        <li><strong>International:</strong> world news affecting Bangladesh and the broader region.</li>
        <li><strong>Sports:</strong> cricket, football, IPL, BPL, PSL, BBL, Olympics, and global tournaments.</li>
        <li><strong>Entertainment:</strong> film, music and culture from Bangladesh, India and the world.</li>
        <li><strong>Islamic:</strong> educational explainers and reference material in a respectful, fair-use format.</li>
      </ul>

      <h2>Contact</h2>
      <p>For corrections, takedown requests, partnerships, or advertising inquiries, please reach us through the <a href="/contact">Contact</a> page or by email. We aim to respond within two business days.</p>

      <Ads />
    </div>
  );
}
