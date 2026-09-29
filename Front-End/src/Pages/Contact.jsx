import { useState } from 'react';
import CreateAnAccoutSection from '../Components/CreateAnAccoutSection';
import PageHeader from '../Components/PageHeader';

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "Deposit", message: "" });
  const [sent, setSent] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // No contact-submission backend exists yet — this is an honest local
  // confirmation rather than a fabricated API call.
  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div>
      <PageHeader title="Contact" crumbs={[{ label: "Home", to: "/" }, { label: "Contact" }]} />

      <div className='flex justify-center pt-10 md:pt-20 px-4'>
        <div className='flex justify-center flex-col gap-4 items-center text-center'>
          <h2 className='text-3xl font-medium'>Leave a message for us</h2>
          <p className='text-slate-500 dark:text-gray-400'>Get in touch with Anchor Exchange</p>
        </div>
      </div>

      <div className='flex flex-col lg:flex-row justify-center items-start gap-10 pt-10 px-4 pb-16 max-w-5xl mx-auto'>
        <div className='hidden lg:block w-full max-w-md h-125 rounded-2xl bg-slate-200 dark:bg-crypto-color border border-gray-200 dark:border-transparent' />

        <div className='w-full max-w-120'>
          {sent ? (
            <div role="status" className='flex flex-col gap-3 items-center text-center py-10 rounded-2xl border border-gray-200 dark:border-line-color'>
              <p className='text-xl font-semibold'>Thanks for reaching out!</p>
              <p className='text-gray-500 dark:text-text-color'>We've received your message and will get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className='flex flex-col gap-5 w-full'>
              <div className='flex flex-col gap-3'>
                <label htmlFor="contact-name">Your Name</label>
                <input
                  id="contact-name"
                  type="text"
                  autoComplete="name"
                  placeholder='Enter your name'
                  required
                  value={form.name}
                  onChange={handleChange("name")}
                  className='w-full h-10 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-lg pl-2 border border-gray-200 dark:border-transparent'
                />
              </div>

              <div className='flex flex-col gap-3'>
                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  autoComplete="email"
                  placeholder='Enter mail'
                  required
                  value={form.email}
                  onChange={handleChange("email")}
                  className='w-full h-10 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-lg pl-2 border border-gray-200 dark:border-transparent'
                />
              </div>

              <div className='flex flex-col gap-3'>
                <label htmlFor="contact-subject">Subject</label>
                <select
                  id="contact-subject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange("subject")}
                  className='w-full bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-sm h-10 pl-1 outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-transparent'
                >
                  <option value="Deposit">Deposit</option>
                  <option value="Withdrawals">Withdrawals</option>
                  <option value="Staking">Staking</option>
                  <option value="NFT">NFT</option>
                  <option value="KYC">KYC</option>
                </select>
              </div>

              <div className='flex flex-col gap-3'>
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  placeholder='Enter your message'
                  required
                  value={form.message}
                  onChange={handleChange("message")}
                  className='w-full h-30 bg-slate-100 dark:bg-input-field text-slate-900 dark:text-white rounded-lg pl-2 pt-2 border border-gray-200 dark:border-transparent'
                />
              </div>

              <button type='submit' className='bg-blue-600 hover:bg-blue-700 rounded-full h-10 mt-5 text-white transition-colors'>
                Send message
              </button>
            </form>
          )}
        </div>
      </div>

      <CreateAnAccoutSection />
    </div>
  );
};

export default Contact;
