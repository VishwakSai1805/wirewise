import type { Lesson } from '../types'
import { arpLesson } from './arp'
import { dhcpLesson } from './dhcp'
import { dnsLesson } from './dns'
import { httpLesson } from './http'
import { icmpLesson } from './icmp'
import { tcpLesson } from './tcp'

export const lessons: Lesson[] = [arpLesson, dhcpLesson, icmpLesson, tcpLesson, dnsLesson, httpLesson]

export const lessonById = (id: string) => lessons.find((l) => l.id === id)
