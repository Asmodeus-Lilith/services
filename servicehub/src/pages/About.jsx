// pages/About.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import './About.css';

const VALUES = [
  {
    icon: 'shield',
    title: 'Trust & Transparency',
    text:
      'Every provider is identity- and background-verified before they can accept a booking. Customers see real ratings and itemised pricing before they commit - no hidden charges, no surprises on the invoice.',
  },
  {
    icon: 'check-circle',
    title: 'Quality First',
    text:
      'Providers are scored on every completed job and held to a minimum service standard. Anything below it is re-attended free of charge under our satisfaction guarantee.',
  },
  {
    icon: 'heart',
    title: 'Community Focus',
    text:
      'Most of our professionals live within a few kilometres of the customers they serve. Every booking keeps money in the neighbourhood and helps a local business grow.',
  },
  {
    icon: 'sparkles',
    title: 'Inclusive Growth',
    text:
      'We lower the barrier to self-employment with plain-language onboarding, training support, and tools that make running a service business possible for first-time entrepreneurs.',
  },
];

const MILESTONES = [
  {
    year: '2020',
    title: 'Founded in Mumbai',
    text: 'Launched with twelve verified home-cleaning professionals and a single-city pilot.',
  },
  {
    year: '2021',
    title: 'Provider verification',
    text: 'Introduced mandatory identity, address, and background checks for every professional on the platform.',
  },
  {
    year: '2022',
    title: 'Ten service categories',
    text: 'Expanded from cleaning into tuition, salon, appliance repair, plumbing, and six further categories.',
  },
  {
    year: '2023',
    title: 'First 100,000 customers',
    text: 'Crossed 100K completed bookings with a 4.8 average rating across all categories.',
  },
  {
    year: '2024',
    title: 'National coverage',
    text: 'Now live in 50+ cities, serving customers and providers across the country.',
  },
];

const LEADERSHIP = [
  {
    name: 'Rahul Mehta',
    role: 'Co-Founder & Chief Executive',
    bio: 'Previously led marketplace operations for a national logistics network. Sets company strategy and partner relationships.',
    photo: 'https://i.pravatar.cc/300?img=12',
  },
  {
    name: 'Ananya Sharma',
    role: 'Co-Founder & Chief Operating Officer',
    bio: 'Built the provider onboarding and verification programme from scratch. Owns service quality and customer support.',
    photo: 'https://i.pravatar.cc/300?img=47',
  },
  {
    name: 'Priya Patel',
    role: 'Chief Technology Officer',
    bio: 'Fifteen years building consumer platforms. Leads the engineering teams behind booking, payments, and messaging.',
    photo: 'https://i.pravatar.cc/300?img=32',
  },
  {
    name: 'Arjun Reddy',
    role: 'Head of Operations',
    bio: 'Runs city-level operations and the provider success team. Focused on on-time arrival and first-time-right resolution.',
    photo: 'https://i.pravatar.cc/300?img=59',
  },
];

const STATS = [
  { value: '500+', label: 'Verified Providers' },
  { value: '100K+', label: 'Happy Customers' },
  { value: '50+', label: 'Cities Covered' },
  { value: '4.9', label: 'Average Rating' },
];

const About = () => (
  <div className="about">
    {/* Hero */}
    <section className="about-hero">
      <div className="container">
        <nav className="about-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">
            <Icon name="home" size={13} />
            Home
          </Link>
          <span className="about-breadcrumb-sep" aria-hidden="true">/</span>
          <span aria-current="page">About Us</span>
        </nav>

        <div className="about-hero-copy">
          <span className="about-eyebrow">
            <Icon name="badgecheck" size={13} />
            Our Story
          </span>
          <h1 className="about-title">
            The team making local services{' '}
            <span className="about-title-accent">worth trusting</span>
          </h1>
          <p className="about-subtitle">
            ServiceHub connects households with verified local professionals for cleaning,
            tuition, salon, repair, and plumbing. We handle the vetting, the booking, and the
            guarantee, so you can get on with your day.
          </p>
        </div>

        <div className="about-hero-proof">
          <div className="about-proof-item">
            <Icon name="shield" size={16} />
            <span>Background-verified providers</span>
          </div>
          <div className="about-proof-item">
            <Icon name="check-circle" size={16} />
            <span>Satisfaction guarantee on every job</span>
          </div>
          <div className="about-proof-item">
            <Icon name="clock" size={16} />
            <span>Booking confirmed in under two minutes</span>
          </div>
        </div>
      </div>
    </section>

    {/* Our Story */}
    <section className="about-section">
      <div className="container">
        <div className="about-grid">
          <div className="about-copy">
            <span className="about-label">01 - Who We Are</span>
            <h2 className="about-heading">Our Story</h2>
            <p>
              ServiceHub began in 2020 with a frustrating personal experience: three no-shows in a
              single week from professionals booked through word of mouth. The problem was not a
              shortage of skilled people, it was the absence of accountability.
            </p>
            <p>
              So we built the marketplace we wanted to exist. One where a provider's identity is
              confirmed, their work is rated by real customers, and a booking carries a guarantee
              rather than a promise. That pilot in Mumbai has since grown into a national platform,
              but the premise has not changed.
            </p>
            <blockquote className="about-quote">
              <p>
                &ldquo;Hire a stranger with confidence.&rdquo; That is the standard every product
                decision is measured against.
              </p>
              <cite>Rahul Mehta - Co-Founder &amp; CEO</cite>
            </blockquote>
          </div>

          <figure className="about-figure">
            <img
              src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=900"
              alt="ServiceHub team collaborating around a table"
              loading="lazy"
            />
            <figcaption className="about-figure-caption">
              <span className="about-figure-metric">
                <strong>6 yrs</strong> building the platform
              </span>
              <span className="about-figure-metric">
                <strong>12</strong> providers at launch
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    {/* Vision & Mission */}
    <section className="about-section about-section--tint">
      <div className="container">
        <div className="about-grid about-grid--reverse">
          <div className="about-pillars">
            <article className="pillar">
              <span className="pillar-icon">
                <Icon name="compass" size={20} />
              </span>
              <div>
                <span className="pillar-label">Our Vision</span>
                <h3 className="pillar-title">Trusted help, within reach of every household</h3>
                <p>
                  A world where any home can call on a verified, fairly-priced professional within
                  minutes, and where quality of work is the expectation rather than the exception.
                </p>
              </div>
            </article>

            <article className="pillar">
              <span className="pillar-icon">
                <Icon name="zap" size={20} />
              </span>
              <div>
                <span className="pillar-label">Our Mission</span>
                <h3 className="pillar-title">Make booking local services effortless</h3>
                <p>
                  Give local professionals the tools, training, and steady demand to grow, while
                  giving customers rigorous verification and transparent pricing on every booking.
                </p>
              </div>
            </article>
          </div>

          <figure className="about-figure">
            <img
              src="https://images.unsplash.com/photo-1551650975-87deedd944c3?w=900"
              alt="Verified ServiceHub professional at work"
              loading="lazy"
            />
            <figcaption className="about-figure-caption">
              <span className="about-figure-metric">
                <strong>100%</strong> of providers verified
              </span>
              <span className="about-figure-metric">
                <strong>0</strong> hidden fees
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    {/* Values */}
    <section className="about-section">
      <div className="container">
        <header className="about-section-head">
          <span className="about-label">02 - How We Work</span>
          <h2 className="about-heading about-heading--center">Our Values</h2>
          <p className="about-section-lead">
            Four principles that decide what we build, who we partner with, and what we refuse to
            compromise on.
          </p>
        </header>

        <div className="values-grid">
          {VALUES.map((value) => (
            <article className="value-card" key={value.title}>
              <span className="value-icon">
                <Icon name={value.icon} size={20} />
              </span>
              <h3>{value.title}</h3>
              <p>{value.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* Impact */}
    <section className="about-stats">
      <div className="container">
        <header className="about-section-head">
          <span className="about-label">03 - Our Impact</span>
          <h2 className="about-heading about-heading--center">The numbers behind the platform</h2>
          <p className="about-section-lead">
            Six years in, measured across every completed booking on ServiceHub.
          </p>
        </header>

        <dl className="stats-grid">
          {STATS.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <dd className="stat-number">{stat.value}</dd>
              <dt className="stat-label">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>

    {/* Timeline */}
    <section className="about-section">
      <div className="container">
        <header className="about-section-head">
          <span className="about-label">04 - Where We Came From</span>
          <h2 className="about-heading about-heading--center">Milestones</h2>
          <p className="about-section-lead">
            From a twelve-provider pilot to a national marketplace.
          </p>
        </header>

        <ol className="timeline">
          {MILESTONES.map((item) => (
            <li className="timeline-item" key={item.year}>
              <span className="timeline-year">{item.year}</span>
              <div className="timeline-body">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* Leadership */}
    <section className="about-section about-section--tint">
      <div className="container">
        <header className="about-section-head">
          <span className="about-label">05 - Leadership</span>
          <h2 className="about-heading about-heading--center">Meet Our Leadership</h2>
          <p className="about-section-lead">
            The people accountable for keeping the platform honest.
          </p>
        </header>

        <div className="team-grid">
          {LEADERSHIP.map((person) => (
            <article className="team-card" key={person.name}>
              <div className="team-photo">
                <img src={person.photo} alt={`${person.name}, ${person.role}`} loading="lazy" />
              </div>
              <h3>{person.name}</h3>
              <p className="team-role">{person.role}</p>
              <p className="team-bio">{person.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="about-cta">
      <div className="container">
        <div className="about-cta-content">
          <span className="about-eyebrow about-eyebrow--light">
            <Icon name="arrow-right" size={13} />
            Get Started
          </span>
          <h2>Ready to experience the ServiceHub difference?</h2>
          <p>
            Join the customers who trust us with their homes, or become a verified provider and
            grow your business with steady, qualified demand.
          </p>
          <div className="about-actions">
            <Link to="/services" className="btn btn-light btn-lg">
              Browse Services
              <Icon name="arrow-right" size={17} />
            </Link>
            <Link to="/register" className="btn btn-ghost-light btn-lg">
              Become a Provider
            </Link>
          </div>
        </div>
      </div>
    </section>
  </div>
);

export default About;
