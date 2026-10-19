import { createEvent, fireEvent } from '@testing-library/react'

/** Fires animationend; jsdom has no AnimationEvent, so the name is set by hand. */
export function endAnimation(el: Element, animationName = 'console-out') {
  const event = createEvent.animationEnd(el)
  Object.defineProperty(event, 'animationName', { value: animationName })
  fireEvent(el, event)
}
