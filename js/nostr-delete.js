const checkMark = '&#10003;'
const txt = {
  broadcasting: 'Broadcasting to relays... ',
  notFound: 'Note not found',
}

const handleFetch = async () => {
  resetUI()
  // validate id is present
  const id = $('#id').val()
  if (!id) throwError('Missing nostr id')
  // validate is a valid nip19
  const hex = nip19ToHex(id)
  console.log('hex', hex)
  if (!hex) throwError('Invalid Nostr note (should be NIP19)')
  // fetch event from relays
  const data = await fetchNote(hex.id)
  if (!data) throwError('Event not found')
  // validate pubkey
  const ok = await validatePubkey(data)
  if (!ok) throwError('Invalid pubkey')
  // add event handler
  $('#delete-note').on('click', () => deleteNote(data))
  $('#note-box').css('visibility', 'visible')
}

const deleteNote = (data) => {
  const kind5 = { ...data, kind: 5 }
  window.nostr
    .signEvent(kind5)
    .then((signed) => {
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
      broadcastEvents([data]).then(() => {
        // inform user broadcasting is done
        $('#broadcasting-status').html(txt.broadcasting + checkMark)
        clearInterval(fetchInterval)
        $('#broadcasting-progress').val(20)
      })
    })
    .catch((err) => console.log(err))
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
  console.log('filter', filter)
  const data = await getEvent(filter)
  console.log('data2', data)
  $('#fetch-note').prop('disabled', true)
  return data
}

const validatePubkey = async (data) => {
  const pubkey = await window.nostr.getPublicKey()
  console.log('pubkey', pubkey)
  console.log('data', data)
  return data.pubkey === pubkey
}

const nip19ToHex = (id) => {
  const { prefix, words } = bech32.bech32.decode(id, id.length)
  if (!['note', 'nevent'].includes(prefix)) return
  const data = new Uint8Array(bech32.bech32.fromWords(words))
  if (prefix === 'note') {
    return {
      id: buffer.Buffer.from(data).toString('hex'),
    }
  }
  if (prefix === 'nevent') {
    let tlv = parseTLV(data)
    if (!tlv[0]?.[0]) throw new Error('missing TLV 0 for nevent')
    if (tlv[0][0].length !== 32) throw new Error('TLV 0 should be 32 bytes')
    return {
      id: buffer.Buffer.from(tlv[0][0]).toString('hex'),
    }
  }
}

const parseTLV = (data) => {
  let result = {}
  let rest = data
  while (rest.length > 0) {
    let t = rest[0]
    let l = rest[1]
    let v = rest.slice(2, 2 + l)
    rest = rest.slice(2 + l)
    if (v.length < l) throw new Error(`not enough data to read on TLV ${t}`)
    result[t] = result[t] || []
    result[t].push(v)
  }
  return result
}

const throwError = (err) => {
  $('#error-box').css('visibility', 'visible')
  $('#error-box').text(err)
  console.log('error', err)
  throw err
}
