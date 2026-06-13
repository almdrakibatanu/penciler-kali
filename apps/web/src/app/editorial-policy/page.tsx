import type { Metadata } from 'next';
import { Ads } from '@/components/Ads';

export const metadata: Metadata = {
  title: 'Editorial Policy — PencilerKali.com',
  description:
    'PencilerKali.com\'s editorial standards: how we source, write, fact-check, and correct news, our use of AI with human oversight, and how to request a correction.',
  alternates: { canonical: '/editorial-policy' },
};

export default function EditorialPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-4">Editorial Policy</h1>
      <p className="text-sm text-ink-500">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <p>PencilerKali.com is an independent Bangla news platform. This page explains how our newsroom works so readers know exactly what they are reading and can hold us accountable.</p>

      <h2>Ownership & contact</h2>
      <p>PencilerKali.com is independently owned and operated. Editorial, correction, and takedown requests can be sent through our <a href="/contact">Contact</a> page; we aim to respond within two business days.</p>

      <h2>How we source news</h2>
      <p>We gather information only from publicly available material — reputable news RSS feeds, official press releases, and verified public statements. Every published article lists the original source URLs it was built from, shown under "তথ্যসূত্র" on the article page, so readers can trace each story back to its origins.</p>

      <h2>AI assistance and human oversight</h2>
      <p>We use an AI editorial workflow to summarise and re-write news into clean, original Bangla. AI is a drafting tool, not the final authority: our standards are defined by humans, sensitive categories are routed for manual review, and political content is never auto-published — it is held until a human reviewer validates every claim. We do not publish AI-generated content that we cannot trace to a credible source.</p>

      <h2>Accuracy & fact-checking</h2>
      <p>Each story is cross-checked against its original sources before publication. We do not publish unverified personal allegations, rumours, or content designed to mislead. Where facts are still developing, we say so.</p>

      <h2>Standards & prohibited content</h2>
      <ul>
        <li>No plagiarism — every story is re-written and credited to its sources.</li>
        <li>No hate speech, harassment, or incitement to violence.</li>
        <li>No graphic, exploitative, or sensationalised treatment of tragedy.</li>
        <li>Islamic content is published as respectful, fair-use educational explainers only.</li>
        <li>Bangladesh coverage focuses on factual, developmental, and non-partisan reporting; political material is reviewed manually before any publication.</li>
      </ul>

      <h2>Corrections</h2>
      <p>If we get something wrong, we want to fix it. To request a correction or removal, contact us with the article URL and the specific issue. Verified corrections are updated promptly, and significant changes are noted on the article.</p>

      <h2>Advertising & independence</h2>
      <p>We display third-party advertising to fund our work. Advertisers have no influence over editorial decisions, and sponsored material — if any — is clearly distinguished from news.</p>

      <Ads />
    </div>
  );
}
