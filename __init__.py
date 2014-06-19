import stock
import res_users
import res_company
import report
import math
from PIL import Image
from StringIO import StringIO

BITS_PER_BYTE = 8

def pixels_to_epl2_data(pixels, width, height):
    # The EPL2 command for printing graphics expects the
    # image data to be passed as a single, continuous string.
    data = ""

    # Create our image's string of bytes, with each line
    # zero padded to fill out its last byte as needed.
    for y in range(0, height):
        byte = ""

        for x in range(0, width):
            byte += "0" if pixels[x+(width*y)] == 0 else "1"

            if len(byte) == BITS_PER_BYTE:
                data += chr(int(byte, 2))
                byte = ""

        if len(byte) > 0:
            data += chr(int((byte+'00000000')[0:BITS_PER_BYTE], 2))

    return data

def image_to_epl2_command(data, x=0, y=0):
    """Print image data on the label printer

    data - PIL-compatible image data
    x    - x offset
    y    - y offset
    """

    # Convert image data to black and white.
    #img = Image.open(StringIO(data)).convert("1")
    img = Image.open(StringIO(data)).convert("L")

    # Rotate image if necessary.
    if img.size[0] > img.size[1]:
        img = img.rotate(90)

    # Resize image to work with our printer.
    img.thumbnail((812, 1218), Image.ANTIALIAS)

    # Assign variable values for better readability.
    width = img.size[0]
    height = img.size[1]

    # Gonna be iterating over the image data and padding
    # the last bits of each line with enough zero bits to
    # make a full byte. Hence the array instead of just
    # using the function's return value directly.
    #pixels = [px for px in img.getdata()]
    pixels = [0 if px < 128 else 1 for px in img.getdata()]

    data = pixels_to_epl2_data(pixels, width, height)

    # This should eventually be made more generic. Here's what's going on:
    # EPL2 - Let the printer know we'll be sending EPL2 commands.
    # q812 - Set label width to 812 pixels. (We're assuming 4x6 labels here.)
    # Q1218,24+0 - Set label length to 1218 pixels, gap between labels to 8 pixels, and label offset to 0 pixels.
    # S4 - Set print speed to 3.5ips (83mm/s)
    # UN - Disable error reporting.
    # WN - Disable Windows mode. (WY to enable.)
    # ZB - Print bottom of image first. (ZT to print top first.)
    # I8,A,001 - Tell printer to expect 8-bit data (I8), Latin 1 encoding (A), and US localization (001).
    # N - Clear image buffer.
    # GWx,y,w,h,d - Buffer graphic with `x`,`y` offset, width in bytes `w`, height in pixels/bits `h`, and image data `d`.
    # P1 - Print one copy of whatever in the buffer can fit on 1 label.
    return 'GW%s,%s,%s,%s,%s\r\n' % (
            (x, y, int(math.ceil(width/float(BITS_PER_BYTE))), height, data))

def image_to_epl2(data, x=0, y=0):
    return ('EPL2\r\nq812\r\nQ1218,8+0\r\nS4\r\nUN\r\nWN\r\nZB\r\nI8,A,001\r\nN\r\n'
            + image_to_epl2_command(data) + '\r\nP1\r\n'
    )