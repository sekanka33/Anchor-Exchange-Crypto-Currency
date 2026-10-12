import { Link } from 'react-router-dom'
import { FaFacebook, FaLinkedin } from 'react-icons/fa'
import { FaWhatsapp, FaXTwitter } from 'react-icons/fa6'

// One list drives both the desktop and mobile layouts. Items with a `to` are
// real routes; items without one are products/features Anchor Exchange
// doesn't offer yet and are shown as "Soon" rather than as dead links.
const SECTIONS = [
  {
    title: 'PRODUCTS',
    items: [
      { label: 'Spot', to: '/spot' },
      { label: 'Inverse Perpetual' },
      { label: 'USDT Perpetual' },
      { label: 'Exchange', to: '/exchange' },
      { label: 'Launchpad' },
      { label: 'Anchor Pay' },
    ],
  },
  {
    title: 'SERVICES',
    items: [
      { label: 'Buy Crypto', to: '/buy-crypto' },
      { label: 'Markets', to: '/markets' },
      { label: 'Trading Fee', to: '/faq#fees' },
      { label: 'Affiliate Program' },
      { label: 'Referral Program' },
      { label: 'API' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { label: 'Anchor Learn', to: '/blog' },
      { label: 'Help Center', to: '/faq' },
      { label: 'User Feedback' },
      { label: 'Submit Request' },
      { label: 'API Documentation' },
      { label: 'Trading Rules', to: '/faq#trading-rules' },
    ],
  },
  {
    title: 'ABOUT US',
    items: [
      { label: 'About Anchor Exchange', to: '/about' },
      { label: 'Authenticity Check' },
      { label: 'Careers', to: '/careers' },
      { label: 'Contacts', to: '/contact' },
      { label: 'Blog', to: '/blog' },
    ],
  },
]

// No official social accounts are configured yet, so these stay as labelled
// icons instead of links to made-up URLs.
const SOCIALS = [
  { label: 'Facebook', Icon: FaFacebook },
  { label: 'WhatsApp', Icon: FaWhatsapp },
  { label: 'LinkedIn', Icon: FaLinkedin },
  { label: 'X (Twitter)', Icon: FaXTwitter },
]

const FooterItem = ({ item }) =>
  item.to ? (
    <Link to={item.to} className='inline-flex py-0.5 hover:text-blue-500 focus-visible:text-blue-500'>
      {item.label}
    </Link>
  ) : (
    <span className='inline-flex flex-wrap items-center gap-2 py-0.5 text-gray-500 dark:text-gray-400' title='Not available yet'>
      {item.label}
      <span className='rounded-full border border-gray-300 dark:border-gray-600 px-1.5 text-[10px] font-semibold uppercase leading-4 tracking-wide'>
        Soon
      </span>
    </span>
  )

const Footer = () => {
  return (
    <footer className='w-full'>
      {/* Top Footer */}
      <div className='flex flex-col md:flex-row md:flex-wrap md:justify-between gap-x-8 gap-y-7 md:gap-y-10 px-7 md:px-8 py-7 md:py-20 max-w-7xl mx-auto w-full box-border'>
        <div className='flex flex-col gap-2 md:gap-4'>
          {/* Logo */}
          <h2 className='text-lg md:text-2xl font-extrabold'>Anchor Exchange</h2>
          <p className='font-semibold'>Let's talk! 🤙</p>
          <p>+27 123 456 7890</p>
          <p className='break-all'>Anchor@exchange.com</p>
          <p>Free For all of the World people</p>
        </div>

        <div className='flex flex-col md:flex-row md:flex-wrap gap-6 md:gap-8 lg:gap-12 md:justify-between'>
          {SECTIONS.map((section) => (
            <div key={section.title} className='flex flex-col gap-2 md:gap-4'>
              <h2 className='text-lg md:text-base font-bold'>{section.title}</h2>
              <ul className='flex flex-col gap-2 md:gap-3'>
                {section.items.map((item) => (
                  <li key={item.label}>
                    <FooterItem item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className='w-full bg-white border-t border-gray-200 text-gray-600 dark:bg-mist-900 dark:border-transparent dark:text-white transition-colors duration-300'>
        <div className='flex flex-col md:flex-row items-center md:justify-between gap-3 md:gap-4 px-6 md:px-20 py-7 md:py-6 text-center md:text-left'>
          <p>Copyright &copy; {new Date().getFullYear()} Anchor Exchange</p>

          <ul className='flex items-center gap-5 text-gray-600 dark:text-gray-400' aria-label='Social media (coming soon)'>
            {SOCIALS.map(({ label, Icon }) => (
              <li key={label}>
                <span role='img' aria-label={`${label} (coming soon)`} title={`${label} — coming soon`} className='flex'>
                  <Icon size={20} aria-hidden='true' />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default Footer
