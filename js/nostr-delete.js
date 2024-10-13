const checkMark = '&#10003;'
const txt = {
  broadcasting: 'Broadcasting to relays... ',
  notFound: 'Note not found',
}

const handleFetch = async () => {
  resetUI()
  // validate id is present
  const id = $('#id').val()
  if (!id) throwError('missing nostr id')
  // validate is a valid nip19
  const hex = nip19ToHex(id)
  if (!hex) throwError('invalid Nostr note (should be NIP19)')
  // fetch event from relays
  const data = await fetchNote(hex.id)
  if (!data) throwError('event not found')
  // validate pubkey
  const ok = await validatePubkey(data)
  if (!ok) throwError('invalid pubkey')
  // add event handler
  $('#delete-note').on('click', () => deleteNote(data))
  $('#note-box').css('visibility', 'visible')
}

const deleteNote = async (note) => {
  const event = {
    content: 'these post was published by accident',
    created_at: Math.round(new Date().getTime() / 1000),
    kind: 5,
    pubkey: note.pubkey,
    tags: [
      ['e', note.id],
      ['k', note.kind],
    ],
  }
  event.id = await calculateEventID(event)
  console.log('event', event)
  const signed = await window.nostr.signEvent(event)
  console.log('signed', signed)
  // inform user that app is broadcasting from relays
  $('#broadcasting-status').html(txt.broadcasting)
  // show and update broadcasting progress bar
  $('#broadcasting-progress').css('visibility', 'visible')
  const fetchInterval = setInterval(() => {
    // update broadcasting progress bar
    const currValue = parseInt($('#broadcasting-progress').val())
    $('#broadcasting-progress').val(currValue + 1)
  }, 1_000)
  broadcastEvents([signed]).then(() => {
    // inform user broadcasting is done
    $('#broadcasting-status').html(txt.broadcasting + checkMark)
    clearInterval(fetchInterval)
    $('#broadcasting-progress').val(20)
  })
}

const resetUI = () => {
  $('#broadcasting-status').html('')
  $('#broadcasting-progress').css('visibility', 'hidden')
  $('#broadcasting-progress').val(0)
  $('#error-box').css('visibility', 'hidden')
  $('#note-box').css('visibility', 'hidden')
}

const fetchNote = async (id) => {
  $('#fetch-note').prop('disabled', true)
  const filter = { ids: [id] }
  const data = await getEvent(filter)
  $('#fetch-note').prop('disabled', false)
  return data
}

const validatePubkey = async (data) => {
  const pubkey = await window.nostr.getPublicKey()
  return data.pubkey === pubkey
}

const throwError = (err) => {
  $('#error-box').css('visibility', 'visible')
  $('#error-box').text(`Error: ${err}`)
  console.log('error', err)
  throw err
}

document.onload = () => {
  if (!window.nostr) throwError('needs a nip7 browser extension')
}
