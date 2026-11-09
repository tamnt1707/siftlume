/** Who and what: the people or organizations in a story, and a glossary of terms. */
import { defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

export const Person = defineComponent({
  name: 'Person',
  description:
    'A person or organization in the source: name, role (max 6 words), optional stance or quote gist (max 12 words).',
  props: z.object({
    name: z.string(),
    role: z.string(),
    stance: z.string().optional(),
  }),
  component: ({ props }) => {
    const initials = props.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');
    return (
      <li className="g-person">
        <span className="g-person__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="g-person__text">
          <strong>{props.name}</strong>
          <span className="g-person__role">{props.role}</span>
          {props.stance && <span className="g-person__stance">{props.stance}</span>}
        </span>
      </li>
    );
  },
});

export const People = defineComponent({
  name: 'People',
  description:
    'Who is who: the key people or organizations in the source (2-6), for news and stories with several actors.',
  props: z.object({
    items: z.array(Person.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-people">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <ul>{renderNode(props.items)}</ul>
    </section>
  ),
});

export const Term = defineComponent({
  name: 'Term',
  description: 'A technical term and a plain-language meaning (max 15 words).',
  props: z.object({
    term: z.string(),
    meaning: z.string(),
  }),
  component: ({ props }) => (
    <div className="g-term">
      <dt>{props.term}</dt>
      <dd>{props.meaning}</dd>
    </div>
  ),
});

export const Glossary = defineComponent({
  name: 'Glossary',
  description: 'Jargon explained: 2-6 technical terms from the source with plain meanings. Put it after the takeaways.',
  props: z.object({
    terms: z.array(Term.ref),
    heading: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <section className="g-glossary">
      {props.heading && <h2 className="g-heading">{props.heading}</h2>}
      <dl>{renderNode(props.terms)}</dl>
    </section>
  ),
});
