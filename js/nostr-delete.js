// button click handler
const fetchNote = async () => {
  // reset UI
  $('#note-box').css('visibility', 'hidden')
  $('#broadcasting-status').html('')
  $('#broadcasting-progress').css('visibility', 'hidden')
  $('#broadcasting-progress').val(0)
  $('#note-found').text('')
  // messages to show to user
  const checkMark = '&#10003;'
  const txt = {
    broadcasting: 'Broadcasting to relays... ',
    notFound: 'Note not found',
  }
  // parse pubkey ('npub' or hexa)
  const id = nip19ToHex($('#id').val()).id
  if (!id) return
  // disable button (will be re-enable at the end of the process)
  $('#fetch-note').prop('disabled', true)
  // get event from relays
  const filter = { ids: [id] }
  const data = await getEvent(filter)
  // re-enable find note button
  $('#fetch-note').prop('disabled', false)
  $('#note-found').text('Found')
  $('#note-box').css('visibility', 'visible')

  const kind5 = { ...data, kind: 5 }
  console.log('kind5', kind5)

  const deleteNote = () => {
    window.nostr.signEvent(kind5).then((signed) => {
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
  }

  $('#delete-note').on('click', deleteNote)
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
