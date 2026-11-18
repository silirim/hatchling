// The surface module laid over the pet's drawing in the terminal: an empty region as large as the drawing, which hears the pointer.
// The drawing itself (a Raster) is a leaf that takes no press, so this is where a click on the pet lands: a button that goes down
// and comes up inside the region is one cuddle, posted to the hooks module (`ui.message`). It draws nothing over the pet.
// It listens to no key: what is typed after a click is the prompt's, Enter included. By the keyboard a cuddle is /pet pet.

/** @type {import('claude-code').ClientModule<{ columns: number, rows: number }, number>} */
export default function Touch(props, surface) {
  if (surface.state === undefined) { // once: the listeners live as long as the instance
    surface.setState(1)
    let held = false
    surface.onPointer(e => {
      if (e.type === 'down') held = e.button === undefined || e.button === 'left'
      else if (e.type === 'up') { if (held && e.x >= 0 && e.y >= 0 && e.x < props.columns && e.y < props.rows) surface.post({ cuddle: true }); held = false }
      else if (e.type === 'leave') held = false
    })
  }
  return surface.elements.Box({ width: props.columns, height: props.rows })
}
