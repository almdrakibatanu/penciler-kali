import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact Us — PencilerKali.com' };

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 prose-bn">
      <h1 className="font-head font-bold text-3xl mb-4">যোগাযোগ</h1>
      <p>সংশোধন, takedown, partnership বা advertising সংক্রান্ত যেকোনো জিজ্ঞাসায় আমাদের সাথে যোগাযোগ করুন।</p>
      <ul className="mt-4">
        <li>Email: <a href="mailto:contact@pencilerkali.com">contact@pencilerkali.com</a></li>
        <li>Facebook: <a target="_blank" rel="noopener" href="https://www.facebook.com/profile.php?id=100066384905135">@PencilerKali</a></li>
        <li>YouTube: <a target="_blank" rel="noopener" href="https://www.youtube.com/@AMRWorld-gd2sl">@AMRWorld-gd2sl</a></li>
      </ul>
    </div>
  );
}
