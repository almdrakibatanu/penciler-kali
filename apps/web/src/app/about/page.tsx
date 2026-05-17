import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us — PencilerKali.com',
  description: 'Learn about PencilerKali.com, an AI-powered Bangladeshi news platform delivering Bangladesh, international, sports, entertainment and Islamic news in clean Bangla, 24/7.',
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-4">About PencilerKali.com</h1>

      <p>PencilerKali.com is an independent, AI-assisted Bangla news platform serving readers in Bangladesh and the global Bangladeshi diaspora. Our mission is to give every Bangla-speaking reader fast, accurate, well-written news on the topics that matter to their daily life — coverage of Bangladesh, international affairs, sports, entertainment, and Islamic content — without paywalls and without political agitation.</p>

      <h2>Our editorial approach</h2>
      <p>Every story published on PencilerKali.com is synthesised from multiple reputable news sources by a senior-editor-trained AI workflow, and then quality-checked before going live. We follow a strict editorial policy: no plagiarism, no hate speech, no incitement, no unverified personal allegations. For political topics, our reviewers personally validate every claim before publication; in their absence, stories are held for review.</p>

      <h2>How we work</h2>
      <p>Our system collects publicly available news from RSS feeds, official press releases, and verified public social media posts. Each story is then re-written in clean Bangla by our editorial AI, fact-checked against the original sources, and credited transparently — every article on the site includes a full list of source URLs.</p>

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

      <p className="text-sm text-ink-500 mt-8">Some profile details on this page are placeholders during our public launch and will be updated as soon as our editorial team finalises the published version.</p>
    </div>
  );
}
