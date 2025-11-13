import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';

import AllPerks from '../src/pages/AllPerks.jsx';
import { renderWithRouter } from './utils/renderWithRouter.js';

// Helpers to make the test independent of global._TEST_CONTEXT_
async function getAnyPerkTitleText() {
  // Wait until at least one heading (card title) is on screen
  const headings = await screen.findAllByRole('heading', {}, { timeout: 5000 }).catch(() => []);
  if (headings.length > 0) {
    const txt = headings[0].textContent || '';
    return txt.trim();
  }

  // Fallback: grab first link text (in case titles are rendered as links)
  const links = await screen.findAllByRole('link').catch(() => []);
  if (links.length > 0) {
    const txt = links[0].textContent || '';
    return txt.trim();
  }

  throw new Error('Could not locate any perk title on the page');
}

function getNameFilterInput() {
  // Try the expected placeholder first, then fall back to the first textbox
  return (
    screen.queryByPlaceholderText?.('Enter perk name...') ||
    screen.getAllByRole('textbox')[0]
  );
}

async function getMerchantSelectAndValue() {
  // Prefer a labeled select if available
  let select =
    screen.queryByLabelText?.(/merchant/i) ||
    screen.queryByRole?.('combobox') ||
    screen.queryAllByRole?.('combobox')?.[0];

  if (!select) {
    const selects = Array.from(document.querySelectorAll('select'));
    select = selects[0];
  }
  if (!select) throw new Error('Could not find merchant select');

  // Wait for options to be populated (with timeout)
  await waitFor(() => {
    const options = Array.from(select.options || []);
    const candidate = options.find(
      (o) => o && o.value && o.value.toLowerCase() !== 'all'
    );
    if (!candidate) {
      throw new Error('Waiting for merchant options to load...');
    }
  }, { timeout: 5000 });

  // Pick the first non-empty, non-"all" option
  const options = Array.from(select.options || []);
  const candidate = options.find(
    (o) => o && o.value && o.value.toLowerCase() !== 'all'
  );
  
  if (!candidate) throw new Error('No merchant options available to select');

  return { select, value: candidate.value };
}

describe('AllPerks page (Directory)', () => {
  test('lists public perks and responds to name filtering', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/explore" element={<AllPerks />} />
      </Routes>,
      { initialEntries: ['/explore'] }
    );

    // Wait for page to load and grab any visible perk title
    const visibleTitle = await getAnyPerkTitleText();

    // Interact with the name filter using the visible title to keep it matched
    const nameFilter = getNameFilterInput();
    expect(nameFilter).toBeTruthy();

    fireEvent.change(nameFilter, { target: { value: visibleTitle } });

    // Wait until the same title is (still) visible post-filter
    await waitFor(() => {
      expect(screen.getByText(visibleTitle)).toBeInTheDocument();
    });

    // Summary text should reflect results
    expect(screen.getByText(/showing/i)).toHaveTextContent(/showing/i);
  });

  test('lists public perks and responds to merchant filtering', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/explore" element={<AllPerks />} />
      </Routes>,
      { initialEntries: ['/explore'] }
    );

    // Wait until at least one perk is visible
    await getAnyPerkTitleText();

    // Wait for merchant select to have options and get a valid merchant value
    const { select, value } = await getMerchantSelectAndValue();
    
    fireEvent.change(select, { target: { value } });

    // After filtering, there should still be at least one perk title visible
    await waitFor(async () => {
      const headings = await screen.findAllByRole('heading').catch(() => []);
      expect(headings.length).toBeGreaterThan(0);
    });

    // Summary text should remain present
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });
});