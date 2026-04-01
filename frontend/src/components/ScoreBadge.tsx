import ArcGauge from './ArcGauge'

type Props = {
    score: number
    label?: string
    size?: 'sm' | 'md' | 'lg'
}

export default function ScoreBadge({ score, size = 'md' }: Props) {
    const gaugeSize = size === 'lg' ? 96 : size === 'md' ? 72 : 56
    return <ArcGauge score={score} size={gaugeSize} />
}

